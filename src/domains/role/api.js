const express = require('express');
const Joi = require('joi');
const logger = require('../../libraries/log/logger');
const { AppError } = require('../../libraries/error-handling/AppError');

const {
  create,
  search,
  count,
  getById,
  updateById,
  deleteById,
  getAllGroupedByType,
  updateRolePermissions,
} = require('./service');

const {
  createSchema,
  updateSchema,
  idSchema,
  searchSchema,
} = require('./request');
const { validateRequest } = require('../../middlewares/request-validate');
const { logRequest } = require('../../middlewares/log');
const { isAuthorized } = require('../../middlewares/auth/authorization');

const model = 'Role';

const routes = () => {
  const router = express.Router();
  logger.info(`Setting up routes for ${model}`);

  router.get(
    '/search',
    logRequest({}),
    validateRequest({ schema: searchSchema, isQuery: true }),
    async (req, res, next) => {
      try {
        const items = await search(req.query);
        res.json(items);
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    '/count',
    logRequest({}),
    validateRequest({ schema: searchSchema, isQuery: true }),
    async (req, res, next) => {
      try {
        const total = await count(req.query);
        res.json({ total });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/',
    logRequest({}),
    isAuthorized,
    validateRequest({ schema: createSchema }),
    async (req, res, next) => {
      try {
        const item = await create(req.body);
        res.status(201).json(item);
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    '/:id',
    logRequest({}),
    validateRequest({ schema: idSchema, isParam: true }),
    async (req, res, next) => {
      try {
        const item = await getById(req.params.id);
        if (!item) {
          throw new AppError(`${model} not found`, `${model} not found`, 404);
        }
        res.status(200).json(item);
      } catch (error) {
        next(error);
      }
    }
  );

  router.put(
    '/:id',
    logRequest({}),
    isAuthorized,
    validateRequest({ schema: idSchema, isParam: true }),
    validateRequest({ schema: updateSchema }),
    async (req, res, next) => {
      try {
        const item = await updateById(req.params.id, req.body);
        if (!item) {
          throw new AppError(`${model} not found`, `${model} not found`, 404);
        }
        res.status(200).json(item);
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete(
    '/:id',
    logRequest({}),
    isAuthorized,
    validateRequest({ schema: idSchema, isParam: true }),
    async (req, res, next) => {
      try {
        await deleteById(req.params.id);
        res.status(204).json({ message: `${model} is deleted` });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    '/:id/permissions',
    logRequest({}),
    validateRequest({ schema: idSchema, isParam: true }),
    async (req, res, next) => {
      try {
        const role = await getById(req.params.id);
        if (!role) {
          throw new AppError(`${model} not found`, `${model} not found`, 404);
        }
        
        // Get all resources grouped by type
        const resources = await getAllGroupedByType();
        
        // Combine resources with role permissions
        const response = {
          roleId: role._id,
          roleName: role.name,
          resourcesByType: resources,
          permissions: Object.fromEntries(role.permissions)
        };
        
        res.status(200).json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  router.put(
    '/:id/permissions',
    logRequest({}),
    isAuthorized,
    validateRequest({ schema: idSchema, isParam: true }),
    validateRequest({
      schema: Joi.object({
        permissions: Joi.object().pattern(
          Joi.string(),
          Joi.boolean()
        ).required()
      })
    }),
    async (req, res, next) => {
      try {
        const role = await updateRolePermissions(req.params.id, req.body.permissions);
        res.status(200).json(role);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
};

module.exports = { routes };
