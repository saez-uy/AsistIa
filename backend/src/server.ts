import './config/env.js';
import { env } from './config/env.js';
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { logger } from './utils/logger.js';
import { AppError } from './utils/errors.js';
import { prisma } from './services/prisma.service.js';
import { redis } from './services/redis.service.js';
import { startWorkers, stopWorkers } from './services/queue.service.js';

// rawBody necesario para verificar la firma del webhook de Meta
const app = Fastify({ logger: false, bodyLimit: 1_048_576 });

// ── Plugins de seguridad ──────────────────────────────────────────────────────

await app.register(helmet, {
  // Permite que el webhook de Meta reciba el raw body
  contentSecurityPolicy: false,
});

await app.register(cors, {
  origin: env.FRONTEND_URL,
  credentials: true,
});

await app.register(rateLimit, {
  global: true,
  max: 100,
  timeWindow: '1 minute',
});

// Guardar el rawBody para verificar firmas HMAC (webhook de Meta)
app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
  (req as unknown as { rawBody: Buffer }).rawBody = body as Buffer;
  try {
    done(null, JSON.parse((body as Buffer).toString('utf8')));
  } catch (err) {
    done(err as Error);
  }
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
    await redis.connect();
    startWorkers();
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    logger.info(`🚀 FlowChat API corriendo en http://localhost:${env.PORT}`);
  } catch (err) {
    logger.error('Error al iniciar el servidor:', err);
    await stopWorkers();
    await prisma.$disconnect();
    await redis.quit();
    process.exit(1);
  }
};

process.on('SIGTERM', async () => {
  await stopWorkers();
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
});

start();
