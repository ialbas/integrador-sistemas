# integrador-sistemas — sincronização confiável entre sistemas que não se falam

> Serviço de integração que mantém duas fontes em sincronia **sem perder nem duplicar dado**,
> mesmo quando uma delas cai. Idempotência, retry com backoff e dead-letter — o trabalho chato
> que ninguém quer fazer, feito direito.

## Problema

Toda empresa tem dois sistemas que deveriam conversar e não conversam: o ERP e o CRM, a
loja e o estoque, a planilha e a API. A "integração rápida" que alguém fez um dia quebra no
primeiro timeout: dado duplicado, pedido perdido, ninguém sabe o que sincronizou. Integração
de verdade é sobre **o que acontece quando dá errado** — não o caminho feliz.

## Solução

Um serviço de sincronização desenhado para falha: cada evento é processado de forma
**idempotente**, com **retry** automático e **fila morta (DLQ)** para o que não recupera —
e visibilidade total do que entrou, sincronizou ou falhou.

```
Fonte A ──(webhook)──► Integrador ──(upsert idempotente)──► Fonte B
                          │
                          ├─ fila + retry com backoff exponencial
                          ├─ chave de idempotência (sem duplicar)
                          └─ dead-letter queue (falha visível, reprocessável)
```

## Funcionalidades

- 🔁 **Idempotência** — o mesmo evento processado 2x não duplica nada (chave determinística + upsert).
- ⏳ **Retry com backoff exponencial** — timeout/erro transitório não perde o dado; tenta de novo, com teto.
- ☠️ **Dead-letter queue** — o que falha de vez não some: vai pra DLQ, reprocessável, com o erro registrado.
- 📊 **Auditoria** — cada evento rastreável: recebido → retry → sincronizado | dead.

## Stack

`Node.js` · `TypeScript` · `BullMQ` (fila sobre Redis) · `PostgreSQL` · `Docker`

## Como rodar

```bash
cp .env.example .env

# opção 1 — demo offline (sem infra): mostra retry + idempotência + DLQ
npm install && npm run demo

# opção 2 — serviço completo (Redis + Postgres + worker):
docker compose up
npm run seed     # em outro terminal: dispara eventos (inclui falhas)
curl localhost:3000/audit
```

A saída do demo mostra: `ped-1002` falhando e recuperando no retry, `ped-1001`
duplicado sem duplicar (idempotente) e `ped-1003` indo para a dead-letter.

## Estrutura

```
src/
  index.ts    # servidor Fastify: POST /events (entrada) · GET /audit
  queue.ts    # fila BullMQ: enqueue, retry/backoff, dead-letter
  sync.ts     # transformação + upsert idempotente (Postgres / memória)
  audit.ts    # rastro de cada evento
  seed.ts     # dispara eventos de exemplo (com falhas) no serviço completo
  demo.ts     # mesma lógica, offline, sem infra
```

## Resultado

Sincronização que não acorda ninguém de madrugada: dado consistente entre os sistemas,
falha transitória recuperada sozinha, e falha real isolada e visível — em vez de silenciosa.
