import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import * as contactsService from './contacts.service.js';

export const contactsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requireAuth);

  // GET /api/contacts?page=1&limit=20&search=
  app.get('/', async (req) => {
    const { page, limit, search } = req.query as { page?: string; limit?: string; search?: string };
    return contactsService.listContacts(
      req.user.userId,
      page ? parseInt(page) : 1,
      limit ? Math.min(parseInt(limit), 100) : 20,
      search ?? ''
    );
  });

  // GET /api/contacts/:id
  app.get('/:id', async (req) => {
    const { id } = req.params as { id: string };
    return contactsService.getContact(req.user.userId, id);
  });
};
