import { prisma } from '../../services/prisma.service.js';
import { sendText } from '../../services/whatsapp.service.js';
import { NotFoundError, ForbiddenError, AppError, ConflictError } from '../../utils/errors.js';
import type { CreateFlowInput, UpdateFlowInput } from './flows.schemas.js';
import type { Plan } from '@prisma/client';

// Límites de flujos por plan
const FLOW_LIMITS: Record<Plan, number> = {
  FREE:    2,
  STARTER: 10,
  PRO:     Infinity,
};

async function assertOwnsConnection(userId: string, connectionId: string) {
  const conn = await prisma.connection.findUnique({ where: { id: connectionId } });
  if (!conn) throw new NotFoundError('Conexión');
  if (conn.userId !== userId) throw new ForbiddenError();
  return conn;
}

async function assertOwnsFlow(userId: string, flowId: string) {
  const flow = await prisma.flow.findUnique({ where: { id: flowId } });
  if (!flow) throw new NotFoundError('Flujo');
  if (flow.userId !== userId) throw new ForbiddenError();
  return flow;
}

export async function listFlows(userId: string) {
  return prisma.flow.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, name: true, description: true, isActive: true,
      triggerKeyword: true, aiEnabled: true, createdAt: true, updatedAt: true,
      connection: { select: { displayPhone: true, businessName: true } },
      _count: { select: { conversations: true } },
    },
  });
}

export async function getFlow(userId: string, flowId: string) {
  const flow = await prisma.flow.findUnique({
    where: { id: flowId },
    include: { connection: { select: { id: true, displayPhone: true, businessName: true } } },
  });
  if (!flow) throw new NotFoundError('Flujo');
  if (flow.userId !== userId) throw new ForbiddenError();
  return flow;
}

export async function createFlow(userId: string, input: CreateFlowInput) {
  // Verificar ownership de la conexión
  await assertOwnsConnection(userId, input.connectionId);

  // Verificar límite del plan
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const flowCount = await prisma.flow.count({ where: { userId } });
  const limit = FLOW_LIMITS[user.plan];
  if (flowCount >= limit) {
    throw new AppError(
      `Tu plan ${user.plan} permite hasta ${limit} flujo${limit === 1 ? '' : 's'}. Actualizá tu plan para crear más.`,
      'PLAN_LIMIT_REACHED',
      403
    );
  }

  // Verificar que no haya otro flujo activo con el mismo triggerKeyword en la misma conexión
  if (input.triggerKeyword) {
    const conflict = await prisma.flow.findFirst({
      where: { connectionId: input.connectionId, triggerKeyword: input.triggerKeyword, isActive: true },
    });
    if (conflict) throw new ConflictError(`Ya hay un flujo activo con el keyword "${input.triggerKeyword}" en esa conexión`);
  }

  return prisma.flow.create({
    data: {
      userId,
      connectionId:   input.connectionId,
      name:           input.name,
      description:    input.description,
      triggerKeyword: input.triggerKeyword,
      aiEnabled:      input.aiEnabled,
      aiSystemPrompt: input.aiSystemPrompt,
      nodes:          input.nodes,
      edges:          input.edges,
    },
  });
}

export async function updateFlow(userId: string, flowId: string, input: UpdateFlowInput) {
  const flow = await assertOwnsFlow(userId, flowId);

  // Si cambia el triggerKeyword, verificar que no colisione
  if (input.triggerKeyword && input.triggerKeyword !== flow.triggerKeyword) {
    const conflict = await prisma.flow.findFirst({
      where: {
        connectionId: flow.connectionId,
        triggerKeyword: input.triggerKeyword,
        isActive: true,
        NOT: { id: flowId },
      },
    });
    if (conflict) throw new ConflictError(`Ya hay un flujo activo con el keyword "${input.triggerKeyword}" en esa conexión`);
  }

  return prisma.flow.update({
    where: { id: flowId },
    data: {
      ...(input.name           !== undefined && { name: input.name }),
      ...(input.description    !== undefined && { description: input.description }),
      ...(input.triggerKeyword !== undefined && { triggerKeyword: input.triggerKeyword }),
      ...(input.aiEnabled      !== undefined && { aiEnabled: input.aiEnabled }),
      ...(input.aiSystemPrompt !== undefined && { aiSystemPrompt: input.aiSystemPrompt }),
      ...(input.nodes          !== undefined && { nodes: input.nodes }),
      ...(input.edges          !== undefined && { edges: input.edges }),
    },
  });
}

export async function deleteFlow(userId: string, flowId: string) {
  await assertOwnsFlow(userId, flowId);
  await prisma.flow.delete({ where: { id: flowId } });
}

export async function activateFlow(userId: string, flowId: string) {
  const flow = await assertOwnsFlow(userId, flowId);
  if (flow.isActive) return flow;

  // Verificar colisión de keyword al activar
  if (flow.triggerKeyword) {
    const conflict = await prisma.flow.findFirst({
      where: { connectionId: flow.connectionId, triggerKeyword: flow.triggerKeyword, isActive: true },
    });
    if (conflict) throw new ConflictError(`El flujo "${conflict.name}" ya usa el keyword "${flow.triggerKeyword}" en esa conexión`);
  }

  return prisma.flow.update({ where: { id: flowId }, data: { isActive: true } });
}

export async function deactivateFlow(userId: string, flowId: string) {
  await assertOwnsFlow(userId, flowId);
  return prisma.flow.update({ where: { id: flowId }, data: { isActive: false } });
}

export async function testFlow(userId: string, flowId: string, testPhone: string) {
  const flow = await assertOwnsFlow(userId, flowId);
  const connection = await prisma.connection.findUniqueOrThrow({ where: { id: flow.connectionId } });

  const flowNodes = flow.nodes as Array<{ type: string; data: { text?: string; message?: string } }>;
  const firstMessage = flowNodes.find((n) => n.type === 'message' || n.type === 'start');
  const previewText = firstMessage?.data?.text ?? firstMessage?.data?.message
    ?? `[Prueba] Flujo: ${flow.name}`;

  try {
    await sendText(connection, testPhone, `🧪 *Prueba de flujo: ${flow.name}*\n\n${previewText}`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    throw new AppError(`Error al enviar prueba: ${msg}`, 'WHATSAPP_ERROR');
  }
}
