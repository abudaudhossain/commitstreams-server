const config = require('./configs');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');

const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo'); // For storing sessions in MongoDB

const defineRoutes = require('./app');
const { errorHandler } = require('./libraries/error-handling');
const logger = require('./libraries/log/logger');
const { addRequestIdMiddleware } = require('./middlewares/request-context');
const { connectWithMongoDb } = require('./libraries/db');
const {
  getGitHubStrategy,
  clearAuthInfo,
  localStrategy,
  registerUser,
} = require('./auth');

let connection;

const createExpressApp = () => {
  const expressApp = express();
  expressApp.use(addRequestIdMiddleware);
  expressApp.use(helmet());
  expressApp.use(express.urlencoded({ extended: true }));
  expressApp.use(express.json());
  expressApp.use(cookieParser());
  expressApp.use(
    cors({
      origin: config.CLIENT_HOST, // Your frontend origin
      credentials: true,
    })
  );

  passport.use(localStrategy);
  passport.use(getGitHubStrategy());

  const sessionStore = MongoStore.create({ mongoUrl: config.MONGODB_URI }); // Store the reference
  expressApp.use(
    session({
      secret: config.SESSION_SECRET,
      resave: false,
      saveUninitialized: true,
      store: sessionStore,
    })
  );

  expressApp.use(passport.initialize());
  expressApp.use(passport.session());

  passport.serializeUser(function (user, done) {
    done(null, user);
  });

  passport.deserializeUser(function (user, done) {
    done(null, user);
  });

  expressApp.use((req, res, next) => {
    // Log an info message for each incoming request
    logger.info(`${req.method} ${req.originalUrl}`);
    next();
  });

  logger.info('Express middlewares are set up');

  expressApp.get('/api/auth/github', passport.authenticate('github'));
  expressApp.get(
    '/api/auth/github/callback',
    function (req, res, next) {
      passport.authenticate(
        'github',
        {
          failureRedirect: `${config.CLIENT_HOST}/login`,
        },
        (err, user, info, status) => {
          if (err || !user) {
            logger.error('Failed to authenticate user', err);
            return res.redirect(
              `${config.CLIENT_HOST}/login?error=${err?.name}`
            );
          }
          req.logIn(user, function (err) {
            if (err) {
              return res.redirect(
                `${config.CLIENT_HOST}/login?error=failed-to-authenticate`
              );
            }

            // modify the session
            req.session.userId = user._id;
            req.session.sessionId = req.sessionID;
            // update the session
            req.session.save((err) => {
              if (err) {
                logger.error('Failed to save session', err);
              } else {
                logger.info('Session saved');
              }
            });

            next();
          });
        }
      )(req, res, next);
    },
    function (req, res) {
      logger.info('/api/auth/github/callback', { username: req.user.username });
      // prepare the cookie here
      const userId = req.user._id.toString();

      res.cookie('userId', userId, {
        httpOnly: true,
        secure: true, // Use secure in production (HTTPS)
        sameSite: 'lax', // Adjust depending on deployment
      });
      // Successful authentication, redirect home.
      res.redirect(`${config.CLIENT_HOST}/login-success`);
    }
  );
  // get current logged in user data from req.user object
  expressApp.get('/api/user', (req, res) => {
    if (!req.user) {
      return res.status(401).send('Unauthorized');
    }
    const { accessToken, accessTokenIV, ...user } = req.user;
    res.json(user);
  });

  expressApp.post('/api/register', async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const newUser = await registerUser({ email, password });
      res
        .status(201)
        .json({ message: 'User registered successfully', userId: newUser._id });
    } catch (err) {
      next(err);
    }
  });

  expressApp.post('/api/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
      logger.info('Login attempt', { err, user, info });
      if (err) {
        return next(err);
      }
      if (!user) {
        return res
          .status(401)
          .json({ message: info.message || 'Authentication failed' });
      }
      req.logIn(user, (err) => {
        if (err) {
          return next(err);
        }
        const { password, ...userWithoutPassword } = user;
        return res.json({
          message: 'Login successful',
          user: userWithoutPassword,
        });
      });
    })(req, res, next);
  });

  expressApp.get('/api/logout', async (req, res, next) => {
    const username = req.user?.username;
    const userId = req.user?._id;

    req.logout(async function (err) {
      // Passport.js logout function
      if (err) {
        logger.error('Failed to log out user', err);
        return next(err);
      }

      req.session.destroy(function (err) {
        // Handle potential errors during session destruction
        if (err) {
          logger.error('Failed to destroy session', err);
        } else {
          logger.info('Session destroyed');
        }
      });

      res.cookie('userId', '', {
        expires: new Date(0), // Set expiry date to a time in the past
        httpOnly: true,
        secure: true, // Use secure in production (HTTPS)
        sameSite: 'lax', // Adjust depending on deployment
      });

      await clearAuthInfo(userId);

      logger.info('User logged out', { username });
      res.redirect(`${config.CLIENT_HOST}/login`);
    });
  });

  defineRoutes(expressApp);
  defineErrorHandlingMiddleware(expressApp);
  return expressApp;
};

async function startWebServer() {
  logger.info('Starting web server...');
  const expressApp = createExpressApp();
  const APIAddress = await openConnection(expressApp);
  logger.info(`Server is running on ${APIAddress.address}:${APIAddress.port}`);
  await connectWithMongoDb();
  return expressApp;
}

async function stopWebServer() {
  return new Promise((resolve) => {
    if (connection !== undefined) {
      connection.close(() => {
        resolve();
      });
    }
  });
}

async function openConnection(expressApp) {
  return new Promise((resolve) => {
    const webServerPort = config.PORT;
    logger.info(`Server is about to listen to port ${webServerPort}`);

    connection = expressApp.listen(webServerPort, () => {
      errorHandler.listenToErrorEvents(connection);
      resolve(connection.address());
    });
  });
}

function defineErrorHandlingMiddleware(expressApp) {
  expressApp.use(async (error, req, res, next) => {
    // Note: next is required for Express error handlers
    if (error && typeof error === 'object') {
      if (error.isTrusted === undefined || error.isTrusted === null) {
        error.isTrusted = true;
      }
    }

    const appError = await errorHandler.handleError(error);
    res
      .status(error?.HTTPStatus || 500)
      .json(
        { ...appError, errorMessage: appError.message } || {
          message: 'Internal server error',
        }
      )
      .end();
  });
}

module.exports = { createExpressApp, startWebServer, stopWebServer };
