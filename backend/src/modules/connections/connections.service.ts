import { prisma } from '../../services/prisma.service.js';
import { encrypt, decrypt } from '../../services/crypto.service.js';
import { sendText } from '../../services/whatsapp.service.js';
import { NotFoundError, ForbiddenError, ConflictError, AppError } from '../../utils/errors.js';
import type { CreateConnectionInput } from './connections.schemas.js';

// Nunca devolver el accessToken encriptado al cliente
function safeConnection(c: { accessToken: string; [key: string]: unknown }) {
  const { accessToken: _, ...rest } = c;
  return rest;
}

export async function listConnections(userId: string) {
  const connections = await prisma.connection.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, userId: true, phoneNumberId: true,
      displayPhone: true, businessName: true, isActive: true, createdAt: true,
    },
  });
  return connections;
}

export async function createConnection(userId: string, input: CreateConnectionInput) {
  // Verificar que el phoneNumberId no esté ya en uso por otro usuario
  const existing = await prisma.connection.findUnique({
    where: { phoneNumberId: input.phoneNumberId },
  });
  if (existing) {
    throw new ConflictError('Ese número de WhatsApp ya está conectado a otra cuenta');
  }

  const connection = await prisma.connection.create({
    data: {
      userId,
      phoneNumberId: input.phoneNumberId,
      displayPhone:  input.displayPhone,
      accessToken:   encrypt(input.accessToken), // Guardamos encriptado
      businessName:  input.businessName,
    },
  });
  return safeConnection(connection);
}

export async function deleteConnection(userId: string, connectionId: string) {
  const connection = await prisma.connection.findUnique({ where: { id: connectionId } });
  if (!connection) throw new NotFoundError('Conexión');
  if (connection.userId !== userId) throw new ForbiddenError();

  await prisma.connection.delete({ where: { id: connectionId } });
}

export async function testConnection(userId: string, connectionId: string, testPhone: string) {
  const connection = await prisma.connection.findUnique({ where: { id: connectionId } });
  if (!connection) throw new NotFoundError('Conexión');
  if (connection.userId !== userId) throw new ForbiddenError();
  if (!connection.isActive) throw new AppError('La conexión está desactivada', 'CONNECTION_INACTIVE');

  // Intenta enviar un mensaje de prueba — si Meta rechaza el token, el error se propaga
  try {
    await sendText(connection, testPhone, `✅ Conexión exitosa con FlowChat! Tu número ${connection.displayPhone} está correctamente configurado.`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    throw new AppError(`Error al enviar mensaje de prueba: ${msg}`, 'WHATSAPP_ERROR');
  }
}
