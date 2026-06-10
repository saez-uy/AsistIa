import { prisma } from '../../services/prisma.service.js';
import { NotFoundError, ForbiddenError } from '../../utils/errors.js';
import type { ConvStatus } from '@prisma/client';

export async function listConversations(
  userId: string,
  page = 1,
  limit = 20,
  status?: ConvStatus,
  flowId?: string
) {
  const skip = (page - 1) * limit;

  // Solo las conversaciones de los contactos de este usuario
  const where = {
    contact: { userId },
    ...(status && { status }),
    ...(flowId  && { flowId }),
  };

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        contact: { select: { phone: true, name: true } },
        flow:    { select: { name: true } },
        _count:  { select: { messages: true } },
      },
    }),
    prisma.conversation.count({ where }),
  ]);

  return { data: conversations, total, page, pages: Math.ceil(total / limit) };
}

export async function getConversation(userId: string, conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      contact:  { select: { phone: true, name: true, userId: true } },
      flow:     { select: { name: true, nodes: true } },
      messages: { orderBy: { sentAt: 'asc' } },
    },
  });
  if (!conversation) throw new NotFoundError('Conversación');
  if (conversation.contact.userId !== userId) throw new ForbiddenError();
  return conversation;
}
