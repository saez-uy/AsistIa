import type { FastifyPluginAsync } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { registerSchema, loginSchema, refreshSchema } from './auth.schemas.js';
import * as authService from './auth.service.js';
import { AppError } from '../../utils/errors.js';

export const authRoutes: FastifyPluginAsync = async (app) => {
  // Rate limit más estricto para endpoints de auth
  await app.register(rateLimit, {
    max: 10,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: () => ({ error: 'Demasiados intentos. Esperá 1 minuto.', code: 'RATE_LIMIT' }),
  });

  // POST /api/auth/register
  app.post('/register', async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message, code: 'VALIDATION_ERROR' });
    }
    const result = await authService.register(parsed.data);
    return reply.status(201).send(result);
  });

  // POST /api/auth/login
  app.post('/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Email o contraseña inválidos', code: 'VALIDATION_ERROR' });
    }
    const result = await authService.login(parsed.data);
    return reply.send(result);
  });

  // POST /api/auth/refresh
  app.post('/refresh', async (req, reply) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'refreshToken requerido', code: 'VALIDATION_ERROR' });
    }
    const result = await authService.refresh(parsed.data.refreshToken);
    return reply.send(result);
  });

  // POST /api/auth/logout
  app.post('/logout', async (req, reply) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (parsed.success) {
      await authService.logout(parsed.data.refreshToken);
    }
    return reply.status(204).send();
  });
};
