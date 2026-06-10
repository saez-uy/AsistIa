import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { createFlowSchema, updateFlowSchema, testFlowSchema } from './flows.schemas.js';
import * as flowsService from './flows.service.js';

export const flowsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requireAuth);

  // GET /api/flows
  app.get('/', async (req) => {
    return flowsService.listFlows(req.user.userId);
  });

  // POST /api/flows
  app.post('/', async (req, reply) => {
    const parsed = createFlowSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message, code: 'VALIDATION_ERROR' });
    }
    const flow = await flowsService.createFlow(req.user.userId, parsed.data);
    return reply.status(201).send(flow);
  });

  // GET /api/flows/:id
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const flow = await flowsService.getFlow(req.user.userId, id);
    return reply.send(flow);
  });

  // PUT /api/flows/:id
  app.put('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateFlowSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message, code: 'VALIDATION_ERROR' });
    }
    const flow = await flowsService.updateFlow(req.user.userId, id, parsed.data);
    return reply.send(flow);
  });

  // DELETE /api/flows/:id
  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await flowsService.deleteFlow(req.user.userId, id);
    return reply.status(204).send();
  });

  // POST /api/flows/:id/activate
  app.post('/:id/activate', async (req, reply) => {
    const { id } = req.params as { id: string };
    const flow = await flowsService.activateFlow(req.user.userId, id);
    return reply.send(flow);
  });

  // POST /api/flows/:id/deactivate
  app.post('/:id/deactivate', async (req, reply) => {
    const { id } = req.params as { id: string };
    const flow = await flowsService.deactivateFlow(req.user.userId, id);
    return reply.send(flow);
  });

  // POST /api/flows/:id/test
  app.post('/:id/test', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = testFlowSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message, code: 'VALIDATION_ERROR' });
    }
    const result = await flowsService.testFlow(req.user.userId, id, parsed.data.testPhone);
    return reply.send(result);
  });
};
