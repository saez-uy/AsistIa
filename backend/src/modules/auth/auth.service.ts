import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../../services/prisma.service.js';
import { redis } from '../../services/redis.service.js';
import { env } from '../../config/env.js';
import { ConflictError, UnauthorizedError } from '../../utils/errors.js';
import type { RegisterInput, LoginInput } from './auth.schemas.js';

const ACCESS_TTL  = '15m';
const REFRESH_TTL = 60 * 60 * 24 * 7; // 7 días en segundos

function refreshKey(userId: string, token: string) {
  return `refresh:${userId}:${token}`;
}

function generateTokens(userId: string, email: string) {
  const accessToken = jwt.sign(
    { userId, email },
    env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TTL }
  );
  const refreshToken = crypto.randomBytes(40).toString('hex');
  return { accessToken, refreshToken };
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConflictError('Ya existe una cuenta con ese email');

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: { email: input.email, passwordHash, name: input.name },
    select: { id: true, email: true, name: true, plan: true, createdAt: true },
  });

  const { accessToken, refreshToken } = generateTokens(user.id, user.email);
  await redis.set(refreshKey(user.id, refreshToken), user.id, 'EX', REFRESH_TTL);

  return { user, accessToken, refreshToken };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw new UnauthorizedError('Credenciales inválidas');

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw new UnauthorizedError('Credenciales inválidas');

  const { accessToken, refreshToken } = generateTokens(user.id, user.email);
  await redis.set(refreshKey(user.id, refreshToken), user.id, 'EX', REFRESH_TTL);

  const { passwordHash: _, ...safeUser } = user;
  return { user: safeUser, accessToken, refreshToken };
}

export async function refresh(token: string) {
  // El refresh token no lleva el userId embebido — hay que buscarlo por patrón
  // Usamos un prefijo de búsqueda por el token
  const keys = await redis.keys(`refresh:*:${token}`);
  if (!keys.length) throw new UnauthorizedError('Refresh token inválido o expirado');

  const userId = await redis.get(keys[0]);
  if (!userId) throw new UnauthorizedError('Refresh token inválido o expirado');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (!user) throw new UnauthorizedError('Usuario no encontrado');

  // Rotar: eliminar el token viejo y emitir uno nuevo
  await redis.del(keys[0]);
  const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id, user.email);
  await redis.set(refreshKey(user.id, newRefreshToken), user.id, 'EX', REFRESH_TTL);

  return { accessToken, refreshToken: newRefreshToken };
}

export async function logout(token: string) {
  const keys = await redis.keys(`refresh:*:${token}`);
  if (keys.length) await redis.del(keys[0]);
  // Silencioso aunque el token no exista — idempotente
}
