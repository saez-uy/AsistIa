import type { FastifyPluginAsync } from 'fastify';

// Stub — implementación completa en Paso 6
export const webhooksRoutes: FastifyPluginAsync = async (app) => {
  app.get('/whatsapp', async () => ({ status: 'pending' }));
  app.post('/whatsapp', async (_req, reply) => reply.status(200).send());
};
