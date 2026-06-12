// Demo offline: roda eventos por um retry/DLQ em memória + sync idempotente.
// Sem Redis/Postgres — prova a lógica de resiliência sem infra.
//   npm run demo
import { initSync, processEvent, syncedCount, type Event } from './sync.js';
import { audit } from './audit.js';

const events: Event[] = [
  { id: 'ped-1001', source: 'loja', payload: { total: 250 } },
  { id: 'ped-1002', source: 'loja', payload: { total: 80 }, simulate: 'transient' }, // falha 1x e recupera
  { id: 'ped-1001', source: 'loja', payload: { total: 250 } },                        // duplicado → idempotente
  { id: 'ped-1003', source: 'loja', payload: { total: -5 }, simulate: 'permanent' },  // → dead-letter
];

const MAX = 3;
await initSync();

for (const ev of events) {
  audit(ev.id, 'recebido');
  for (let attempt = 0; attempt <= MAX; attempt++) {
    try { await processEvent(ev, attempt); audit(ev.id, 'sincronizado'); break; }
    catch (e) {
      if (attempt >= MAX) { audit(ev.id, 'dead', (e as Error).message); break; }
      audit(ev.id, 'retry', `tentativa ${attempt}: ${(e as Error).message}`);
      await new Promise((r) => setTimeout(r, 80 * 2 ** attempt)); // backoff exponencial
    }
  }
}

console.log(`\nRegistros sincronizados (únicos): ${syncedCount()}  ← ped-1001 entrou 2x, conta 1 (idempotente)`);
