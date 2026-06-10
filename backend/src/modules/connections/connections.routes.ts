import type { FastifyPluginAsync } from 'fastify';

// Stub — implementación completa en Paso 4
export const connectionsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async () => ({ data: [] }));
};
