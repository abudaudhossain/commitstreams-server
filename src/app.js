const express = require('express');
const logger = require('./libraries/log/logger');
const domainRoutes = require('./domains/index');

function defineRoutes(expressApp) {
  logger.info('Defining routes...');
  const router = express.Router();

  domainRoutes(router);

  expressApp.use('/api/v1', router);
  // health check
  expressApp.get('/health', (req, res) => {
    const healthCheck = {
      uptime: process.uptime(),
      message: 'OK',
      timestamp: Date.now(),
    };
    res.status(200).json(healthCheck);
  });
  // 404 handler
  expressApp.use((req, res) => {
    res.status(404).send('Not Found');
  });
  logger.info('Routes defined');
}

module.exports = defineRoutes;
