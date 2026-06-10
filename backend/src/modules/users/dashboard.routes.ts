import type { FastifyPluginAsync } from 'fastify';

// Stub — implementación completa en Paso 8
export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/stats', async () => ({ data: {} }));
};
