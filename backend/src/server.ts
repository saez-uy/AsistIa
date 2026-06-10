import './config/env.js'; // Valida variables de entorno al arrancar
import { env } from './config/env.js';
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import { PrismaClient } from '@prisma/client';
import { logger } from './utils/logger.js';
import { AppError } from './utils/errors.js';

export const prisma = new PrismaClient();

const app = Fastify({ logger: false });

// ── Plugins de seguridad ──────────────────────────────────────────────────────

await app.register(helmet);

await app.register(cors, {
  origin: env.FRONTEND_URL,
  credentials: true,
});

await app.register(rateLimit, {
  global: true,
  max: 100,
  timeWindow: '1 minute',
});

await app.register(jwt, {
  secret: env.JWT_ACCESS_SECRET,
});

// ── Módulos ───────────────────────────────────────────────────────────────────

const { authRoutes }          = await import('./modules/auth/auth.routes.js');
const { connectionsRoutes }   = await import('./modules/connections/connections.routes.js');
const { flowsRoutes }         = await import('./modules/flows/flows.routes.js');
const { contactsRoutes }      = await import('./modules/contacts/contacts.routes.js');
const { conversationsRoutes } = await import('./modules/conversations/conversations.routes.js');
const { webhooksRoutes }      = await import('./modules/webhooks/webhooks.routes.js');
const { dashboardRoutes }     = await import('./modules/users/dashboard.routes.js');

await app.register(authRoutes,          { prefix: '/api/auth' });
await app.register(connectionsRoutes,   { prefix: '/api/connections' });
await app.register(flowsRoutes,         { prefix: '/api/flows' });
await app.register(contactsRoutes,      { prefix: '/api/contacts' });
await app.register(conversationsRoutes, { prefix: '/api/conversations' });
await app.register(webhooksRoutes,      { prefix: '/api/webhooks' });
await app.register(dashboardRoutes,     { prefix: '/api/dashboard' });

// ── Manejo de errores global ──────────────────────────────────────────────────

app.setErrorHandler((error, _req, reply) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({ error: error.message, code: error.code });
  }
  // Rate limit error
  if (error.statusCode === 429) {
    return reply.status(429).send({ error: 'Demasiadas solicitudes', code: 'RATE_LIMIT' });
  }
  logger.error('Unhandled error:', error);
  return reply.status(500).send({ error: 'Error interno del servidor', code: 'INTERNAL_ERROR' });
});

// ── Healthcheck ───────────────────────────────────────────────────────────────

app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

// ── Inicio ────────────────────────────────────────────────────────────────────

const start = async () => {
  try {
    await prisma.$connect();
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    logger.info(`🚀 FlowChat API corriendo en http://localhost:${env.PORT}`);
  } catch (err) {
    logger.error('Error al iniciar el servidor:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
};

start();
