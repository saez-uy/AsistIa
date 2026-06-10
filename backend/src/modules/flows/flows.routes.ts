import type { FastifyPluginAsync } from 'fastify';

// Stub — implementación completa en Paso 5
export const flowsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async () => ({ data: [] }));
};
