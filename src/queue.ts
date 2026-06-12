// Fila com retry e dead-letter (BullMQ sobre Redis). jobId = id do evento → dedupe
// na entrada. attempts + backoff exponencial; esgotou → DLQ.
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { processEvent, type Event } from './sync.js';
import { audit } from './audit.js';

const connection = new IORedis(process.env.REDIS_URL || 'redis://redis:6379', { maxRetriesPerRequest: null });
export const syncQueue = new Queue('sync', { connection });
export const dlq = new Queue('sync-dead', { connection });

export async function enqueue(ev: Event): Promise<void> {
  audit(ev.id, 'recebido');
  await syncQueue.add('event', ev, {
    jobId: ev.id,                                   // idempotência na entrada
    attempts: 3,
    backoff: { type: 'exponential', delay: 500 },
    removeOnComplete: true,
  });
}

export function startWorker(): Worker {
  const worker = new Worker('sync', async (job) => {
    await processEvent(job.data as Event, job.attemptsMade);
  }, { connection });

  worker.on('completed', (job) => audit(job.data.id, 'sincronizado'));
  worker.on('failed', async (job, err) => {
    if (!job) return;
    const max = job.opts.attempts ?? 1;
    if (job.attemptsMade >= max) { await dlq.add('dead', job.data); audit(job.data.id, 'dead', err.message); }
    else audit(job.data.id, 'retry', `tentativa ${job.attemptsMade}/${max}: ${err.message}`);
  });
  return worker;
}
