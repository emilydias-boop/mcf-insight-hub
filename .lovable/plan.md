## Problema

Vendas A010 vindas via Hubla no fluxo `invoice.payment_succeeded` **sem `items`** estão falhando com:

```
ReferenceError: hublaId is not defined
  at hubla-webhook-handler/index.ts:2243
```

A transação é gravada em `hubla_transactions` e `a010_sales`, mas o erro estoura **antes** de `createOrUpdateCRMContact(...)`, então **o lead nunca entra no CRM Inside Sales** (sem contato → sem deal → sem distribuição).

## Impacto real (não são só 4)

Os 4 logs vistos são 2 webhooks × 2 mensagens. Cruzando `hubla_transactions` A010 × `crm_contacts`:

- **22 leads A010 órfãos** entre 17/06 e 19/06 (7 + 9 + 6).
- Antes de 17/06 a taxa de "sem contato" era 0–2/dia (dedup legítimo) — confirma que o bug entrou em 17/06.
- Lista completa de emails afetados disponível na query de auditoria.

## Causa

Em `supabase/functions/hubla-webhook-handler/index.ts`, no branch "sem items" (~linha 2878), passa-se `hublaId` para `createOrUpdateCRMContact`, mas a variável `hublaId` só é declarada mais adiante, dentro do loop `for (items)` (~linha 2932). Fora do loop ela não existe → ReferenceError fatal.

## Correção (1 linha)

Trocar no objeto passado a `createOrUpdateCRMContact` dentro do bloco A010 sem items:

```ts
hublaId,
```

por:

```ts
hublaId: transactionData.hubla_id ?? invoice?.id ?? null,
```

A assinatura de `createOrUpdateCRMContact` já aceita `hublaId?: string | null`.

## Backfill dos 22 leads

Após o deploy, rodar um script de recuperação que, para cada `hubla_transactions` A010 dos últimos 7 dias cujo `customer_email` não existe em `crm_contacts`, chama `createOrUpdateCRMContact` com:

- `email`, `phone`, `name` da transação
- `originName: 'A010 Hubla'`
- `productName`, `value` (net_value)
- `hublaId` = `hubla_id` da transação

Opção A — edge function pontual `backfill-a010-orphans` invocada uma vez.  
Opção B — reenviar manualmente os webhooks via fila Hubla.

Recomendo Opção A (mais rápida e idempotente — `createOrUpdateCRMContact` já dedupa por origin+contato).

## Validação

1. Logs de `hubla-webhook-handler` sem novo `ReferenceError`.
2. Próxima venda A010 cria contato + deal no CRM (origin `A010 Hubla`).
3. Após backfill, a query de auditoria mostra 0 órfãos para 17/06–19/06.

## Fora de escopo

Sem mudanças em frontend, schema, RLS ou outras integrações.
