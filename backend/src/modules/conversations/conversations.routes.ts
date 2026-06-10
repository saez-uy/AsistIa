import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import * as conversationsService from './conversations.service.js';
import type { ConvStatus } from '@prisma/client';

export const conversationsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requireAuth);

  // GET /api/conversations?page=1&limit=20&status=ACTIVE&flowId=
  app.get('/', async (req) => {
    const { page, limit, status, flowId } = req.query as {
      page?: string; limit?: string; status?: ConvStatus; flowId?: string;
    };
    return conversationsService.listConversations(
      req.user.userId,
      page   ? parseInt(page)  : 1,
      limit  ? Math.min(parseInt(limit), 100) : 20,
      status,
      flowId
    );
  });

  // GET /api/conversations/:id
  app.get('/:id', async (req) => {
    const { id } = req.params as { id: string };
    return conversationsService.getConversation(req.user.userId, id);
  });
};
