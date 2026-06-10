import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../utils/errors.js';

interface JwtPayload {
  userId: string;
  email:  string;
}

// Extiende el tipo de Request para que req.user esté disponible en los handlers
declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload;
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Token requerido', code: 'UNAUTHORIZED' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    req.user = payload;
  } catch {
    return reply.status(401).send({ error: 'Token inválido o expirado', code: 'UNAUTHORIZED' });
  }
}
