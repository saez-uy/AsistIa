import type { FastifyPluginAsync } from 'fastify';

// Stub — implementación completa en Paso 7
export const contactsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async () => ({ data: [] }));
};
