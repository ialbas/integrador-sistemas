import 'dotenv/config';
import Fastify from 'fastify';
import { initSync } from './sync.js';
import { startWorker, enqueue } from './queue.js';
import { getTrail } from './audit.js';

const app = Fastify({ logger: true });

app.get('/health', async () => ({ ok: true }));

// Entrada de eventos da Fonte A (webhook). Enfileira para sync idempotente.
app.post('/events', async (req, reply) => {
  const ev = req.body as { id?: string };
  if (!ev?.id) return reply.code(400).send({ error: 'id obrigatório (chave de idempotência)' });
  await enqueue(ev as any);
  return reply.send({ queued: ev.id });
});

// Auditoria: rastro de cada evento (recebido → retry → sincronizado | dead).
app.get('/audit', async () => getTrail());

const mode = await initSync();
startWorker();
await app.listen({ port: Number(process.env.PORT || 3000), host: '0.0.0.0' });
app.log.info(`integrador-sistemas no ar · destino=${mode}`);
