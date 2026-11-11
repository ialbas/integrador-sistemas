# integrador-sistemas — reliable sync between systems that don't talk to each other

🇧🇷 [Versão em português](./README.pt-BR.md)

> Integration service that keeps two sources in sync **without losing or duplicating data**,
> even when one of them goes down. Idempotency, retry with backoff and dead-letter — the boring
> work nobody wants to do, done right.

## Problem

Every company has two systems that should talk and don't: the ERP and the CRM, the store and
the inventory, the spreadsheet and the API. The "quick integration" someone built one day breaks
on the first timeout: duplicated data, a lost order, nobody knows what was synced. Real
integration is about **what happens when things go wrong** — not the happy path.

## Solution

A sync service designed for failure: every event is processed **idempotently**, with automatic
**retry** and a **dead-letter queue (DLQ)** for what does not recover — and full visibility into
what came in, what synced and what failed.

```
Source A ──(webhook)──► Integrator ──(idempotent upsert)──► Source B
                            │
                            ├─ queue + retry with exponential backoff
                            ├─ idempotency key (no duplicates)
                            └─ dead-letter queue (visible, reprocessable failure)
```

## Features

- 🔁 **Idempotency** — the same event processed twice duplicates nothing (deterministic key + upsert).
- ⏳ **Retry with exponential backoff** — a timeout or transient error does not lose data; it retries, with a cap.
- ☠️ **Dead-letter queue** — what fails for good does not vanish: it goes to the DLQ, reprocessable, with the error recorded.
- 📊 **Audit trail** — every event is traceable: received → retry → synced | dead.

## Stack

`Node.js` · `TypeScript` · `BullMQ` (queue on Redis) · `PostgreSQL` · `Docker`

## How to run

```bash
cp .env.example .env

# option 1 — offline demo (no infra): shows retry + idempotency + DLQ
npm install && npm run demo

# option 2 — full service (Redis + Postgres + worker):
docker compose up
npm run seed   # in another terminal: fires events (including failures)
curl localhost:3000/audit
```

The demo output shows `ped-1002` failing and recovering on retry, `ped-1001` sent twice
without duplicating (idempotent) and `ped-1003` going to the dead-letter queue.

## Structure

```
src/
  index.ts  # Fastify server: POST /events (input) · GET /audit
  queue.ts  # BullMQ queue: enqueue, retry/backoff, dead-letter
  sync.ts   # transformation + idempotent upsert (Postgres / memory)
  audit.ts  # trail of every event
  seed.ts   # fires sample events (with failures) at the full service
  demo.ts   # same logic, offline, no infra
```

## Outcome

A sync that doesn't wake anyone up at night: consistent data across systems, transient
failures recovered on their own, and real failures isolated and visible — instead of silent.
