import type { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { prisma } from '../../services/prisma.service.js';
import { messageQueue } from '../../services/queue.service.js';
import { logger } from '../../utils/logger.js';

export const webhooksRoutes: FastifyPluginAsync = async (app) => {

  // GET /api/webhooks/whatsapp — verificación del webhook por Meta
  app.get('/whatsapp', async (req, reply) => {
    const q = req.query as Record<string, string>;
    if (q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === env.META_WEBHOOK_VERIFY_TOKEN) {
      logger.info('Webhook de WhatsApp verificado');
      return reply.status(200).send(q['hub.challenge']);
    }
    return reply.status(403).send({ error: 'Token inválido', code: 'FORBIDDEN' });
  });

  // POST /api/webhooks/whatsapp — mensajes entrantes de Meta
  app.post('/whatsapp', {
    config: { rawBody: true }, // necesario para verificar la firma
  }, async (req, reply) => {
    // Responder inmediatamente para que Meta no reintente
    reply.status(200).send();

    // Verificar firma X-Hub-Signature-256
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    if (!verifySignature(req.rawBody as Buffer, signature)) {
      logger.warn('Firma de webhook inválida — request ignorada');
      return;
    }

    const body = req.body as MetaWebhookPayload;
    if (body.object !== 'whatsapp_business_account') return;

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue;
        const value = change.value;

        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        // Buscar la conexión correspondiente a este número
        const connection = await prisma.connection.findUnique({ where: { phoneNumberId } });
        if (!connection || !connection.isActive) continue;

        for (const msg of value.messages ?? []) {
          const fromPhone  = msg.from;
          const contactName = value.contacts?.[0]?.profile?.name ?? null;

          // Mensajes de texto
          if (msg.type === 'text' && msg.text?.body) {
            await messageQueue.add('incoming', {
              connectionId:  connection.id,
              fromPhone,
              contactName,
              messageText:   msg.text.body,
              waMessageId:   msg.id,
              buttonPayload: null,
            });
          }

          // Respuestas de botones interactivos
          if (msg.type === 'interactive' && msg.interactive?.button_reply) {
            await messageQueue.add('incoming', {
              connectionId:  connection.id,
              fromPhone,
              contactName,
              messageText:   msg.interactive.button_reply.title,
              waMessageId:   msg.id,
              buttonPayload: msg.interactive.button_reply.id,
            });
          }
        }
      }
    }
  });
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function verifySignature(rawBody: Buffer | undefined, signature: string | undefined): boolean {
  if (!rawBody || !signature) return false;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', env.META_APP_SECRET)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ── Tipos del payload de Meta ──────────────────────────────────────────────────

interface MetaWebhookPayload {
  object: string;
  entry: Array<{
    changes: Array<{
      field: string;
      value: {
        metadata?: { phone_number_id: string };
        messages?: Array<{
          id:   string;
          from: string;
          type: string;
          text?: { body: string };
          interactive?: { button_reply?: { id: string; title: string } };
        }>;
        contacts?: Array<{ profile?: { name: string } }>;
      };
    }>;
  }>;
}
