// Dispara eventos de exemplo (inclui falhas) p/ ver retry e DLQ no serviço completo.
//   docker compose up        (em outro terminal)
//   npm run seed
import 'dotenv/config';
import { enqueue } from './queue.js';
import type { Event } from './sync.js';

const events: Event[] = [
  { id: 'ped-1001', source: 'loja', payload: { total: 250 } },
  { id: 'ped-1002', source: 'loja', payload: { total: 80 }, simulate: 'transient' }, // falha e recupera
  { id: 'ped-1001', source: 'loja', payload: { total: 250 } },                        // duplicado → idempotente
  { id: 'ped-1003', source: 'loja', payload: { total: -5 }, simulate: 'permanent' },  // → dead-letter
];

for (const e of events) await enqueue(e);
console.log('\nseed enfileirado. Veja o processamento no log do app ou em GET /audit.');
setTimeout(() => process.exit(0), 800);
