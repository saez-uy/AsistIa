import { prisma } from '../../services/prisma.service.js';
import { NotFoundError, ForbiddenError } from '../../utils/errors.js';

export async function listContacts(userId: string, page = 1, limit = 20, search = '') {
  const skip = (page - 1) * limit;
  const where = {
    userId,
    ...(search && {
      OR: [
        { phone: { contains: search } },
        { name:  { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  };

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      skip,
      take: limit,
      orderBy: { lastSeen: 'desc' },
      include: { _count: { select: { conversations: true } } },
    }),
    prisma.contact.count({ where }),
  ]);

  return { data: contacts, total, page, pages: Math.ceil(total / limit) };
}

export async function getContact(userId: string, contactId: string) {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: {
      conversations: {
        orderBy: { startedAt: 'desc' },
        take: 10,
        include: {
          flow: { select: { name: true } },
          messages: { orderBy: { sentAt: 'asc' }, take: 5 },
        },
      },
    },
  });
  if (!contact) throw new NotFoundError('Contacto');
  if (contact.userId !== userId) throw new ForbiddenError();
  return contact;
}
