import { Queue, Worker, type Job } from 'bullmq';
import { redis } from './redis.service.js';

// ── Colas ──────────────────────────────────────────────────────────────────────

export const messageQueue = new Queue<IncomingMessageJob>('flowchat:messages', {
  connection: redis,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
});

export const delayQueue = new Queue<DelayedNodeJob>('flowchat:delays', {
  connection: redis,
});

// ── Tipos de jobs ─────────────────────────────────────────────────────────────

export interface IncomingMessageJob {
  connectionId:  string;
  fromPhone:     string;
  contactName:   string | null;
  messageText:   string;
  waMessageId:   string;
  buttonPayload: string | null; // ID del botón presionado, si aplica
}

export interface DelayedNodeJob {
  conversationId: string;
  nextNodeId:     string;
}

// ── Workers (se inicializan desde server.ts) ──────────────────────────────────

let messageWorker: Worker | null = null;
let delayWorker:   Worker | null = null;

export function startWorkers() {
  // Importación dinámica para evitar circular (flow-engine importa queue)
  messageWorker = new Worker<IncomingMessageJob>(
    'flowchat:messages',
    async (job: Job<IncomingMessageJob>) => {
      const { processIncomingMessage } = await import('./flow-engine.service.js');
      await processIncomingMessage(job.data);
    },
    { connection: redis, concurrency: 5 }
  );

  delayWorker = new Worker<DelayedNodeJob>(
    'flowchat:delays',
    async (job: Job<DelayedNodeJob>) => {
      const { resumeAfterDelay } = await import('./flow-engine.service.js');
      await resumeAfterDelay(job.data.conversationId, job.data.nextNodeId);
    },
    { connection: redis, concurrency: 5 }
  );

  messageWorker.on('failed', (job, err) => {
    console.error(`[Queue] Job ${job?.id} failed:`, err.message);
  });
}

export function stopWorkers() {
  return Promise.all([messageWorker?.close(), delayWorker?.close()]);
}
