import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { createConnectionSchema, testConnectionSchema } from './connections.schemas.js';
import * as connectionsService from './connections.service.js';

export const connectionsRoutes: FastifyPluginAsync = async (app) => {
  // Todos los endpoints requieren autenticación
  app.addHook('preHandler', requireAuth);

  // GET /api/connections
  app.get('/', async (req) => {
    return connectionsService.listConnections(req.user.userId);
  });

  // POST /api/connections
  app.post('/', async (req, reply) => {
    const parsed = createConnectionSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message, code: 'VALIDATION_ERROR' });
    }
    const connection = await connectionsService.createConnection(req.user.userId, parsed.data);
    return reply.status(201).send(connection);
  });

  // DELETE /api/connections/:id
  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await connectionsService.deleteConnection(req.user.userId, id);
    return reply.status(204).send();
  });

  // POST /api/connections/:id/test
  app.post('/:id/test', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = testConnectionSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message, code: 'VALIDATION_ERROR' });
    }
    const result = await connectionsService.testConnection(req.user.userId, id, parsed.data.testPhone);
    return reply.send(result);
  });
};
