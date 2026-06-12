// Rastro de auditoria: todo evento é rastreável (recebido → retry → sincronizado | dead).
export type Status = 'recebido' | 'sincronizado' | 'retry' | 'dead';

const trail: { id: string; status: Status; detail?: string; at: string }[] = [];

export function audit(id: string, status: Status, detail?: string): void {
  const e = { id, status, detail, at: new Date().toISOString() };
  trail.push(e);
  const icon = { recebido: '📥', retry: '🔁', sincronizado: '✅', dead: '☠️' }[status];
  console.log(`${icon} ${id} → ${status}${detail ? ' · ' + detail : ''}`);
}

export function getTrail() { return trail; }
