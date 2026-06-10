import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { prisma } from '../../services/prisma.service.js';

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requireAuth);

  // GET /api/dashboard/stats
  app.get('/stats', async (req) => {
    const userId = req.user.userId;

    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const week  = new Date(today);
    week.setDate(week.getDate() - 6);

    // Obtener contactIds del usuario
    const contactIds = await prisma.contact
      .findMany({ where: { userId }, select: { id: true } })
      .then((c) => c.map((x) => x.id));

    const [convsToday, convsWeek, completed, abandoned, newContacts, dailyRaw] = await Promise.all([
      // Conversaciones iniciadas hoy
      prisma.conversation.count({
        where: { contactId: { in: contactIds }, startedAt: { gte: today } },
      }),
      // Conversaciones esta semana
      prisma.conversation.count({
        where: { contactId: { in: contactIds }, startedAt: { gte: week } },
      }),
      // Completadas esta semana
      prisma.conversation.count({
        where: { contactId: { in: contactIds }, status: 'COMPLETED', startedAt: { gte: week } },
      }),
      // Abandonadas esta semana
      prisma.conversation.count({
        where: { contactId: { in: contactIds }, status: 'ABANDONED', startedAt: { gte: week } },
      }),
      // Contactos nuevos esta semana
      prisma.contact.count({
        where: { userId, createdAt: { gte: week } },
      }),
      // Conversaciones por día (últimos 7 días)
      prisma.conversation.findMany({
        where: { contactId: { in: contactIds }, startedAt: { gte: week } },
        select: { startedAt: true },
      }),
    ]);

    // Agrupar por día
    const dailyMap: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(week);
      d.setDate(d.getDate() + i);
      dailyMap[d.toISOString().split('T')[0]] = 0;
    }
    for (const conv of dailyRaw) {
      const key = conv.startedAt.toISOString().split('T')[0];
      if (key in dailyMap) dailyMap[key]++;
    }
    const daily = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

    const completionRate = convsWeek > 0 ? Math.round((completed / convsWeek) * 100) : 0;

    return {
      convsToday,
      convsWeek,
      completionRate,
      abandoned,
      newContacts,
      daily,
    };
  });
};
