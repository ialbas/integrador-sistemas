// Motor de sincronização: transforma e faz UPSERT idempotente no destino.
// O mesmo evento (mesmo id) processado N vezes não duplica — chave determinística.
// Suporta simulação de falha p/ exercitar retry/DLQ. Postgres com fallback em memória.
import pg from 'pg';

export interface Event { id: string; source: string; payload: unknown; simulate?: 'transient' | 'permanent'; }

let pool: pg.Pool | null = null;
const synced = new Map<string, { source: string; payload: unknown }>();

export async function initSync(): Promise<'postgres' | 'memory'> {
  const url = process.env.DATABASE_URL;
  if (!url) return 'memory';
  try {
    pool = new pg.Pool({ connectionString: url });
    await pool.query(`CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY, source TEXT, payload JSONB, updated_at TIMESTAMPTZ DEFAULT now())`);
    return 'postgres';
  } catch (e) {
    console.error('Postgres indisponível, usando memória:', (e as Error).message);
    pool = null;
    return 'memory';
  }
}

export async function processEvent(ev: Event, attempt: number): Promise<void> {
  if (ev.simulate === 'permanent') throw new Error('falha permanente (payload inválido)');
  if (ev.simulate === 'transient' && attempt < 2) throw new Error(`timeout transitório (tentativa ${attempt})`);
  // UPSERT idempotente
  if (pool) {
    await pool.query(
      'INSERT INTO records (id, source, payload) VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE SET payload=$3, updated_at=now()',
      [ev.id, ev.source, JSON.stringify(ev.payload)],
    );
  } else {
    synced.set(ev.id, { source: ev.source, payload: ev.payload });
  }
}

export function syncedCount(): number { return pool ? -1 : synced.size; }
