
# Garantia 1:1 — Toda compra A010 (Kiwify+Hubla) vira deal e bate com o relatório

Objetivo: zerar gap entre compras e deals (nome+email+telefone) e fazer "leads que entram" == "leads no relatório".

Hoje há 5 pontos de falha silenciosa identificados:

1. **Branches `return { dealId: null }` no `kiwify-webhook-handler`** (linhas 93, 120, 326, 418, 425) — sem email+phone, sem contactId/originId, deal duplicado, erro de insert. Webhook responde 200 OK e ninguém sabe.
2. **Trigger `duplicate_contact:phone:<uuid>`** — rejeita insert de contato; handlers atuais não capturam a `<uuid>` retornada para reaproveitar o contato existente.
3. **`clint-webhook-handler` (rota legada ClientData)** — cria deal A010 mas não escreve em `hubla_transactions`. Some do dashboard.
4. **`kiwify-backfill-a010-csv`** — cria deal sem espelhar em `hubla_transactions`. Some do dashboard.
5. **Relatório (`get_all_hubla_transactions`)** usa `INNER JOIN linked_deal_id` — qualquer transação sem link cai fora.

---

## Solução em 3 camadas

### Camada 1 — Ingestão à prova de falha (Kiwify + Hubla)

Princípio: **toda venda paga entra na fila e nunca é descartada silenciosamente.**

**1.1** Refatorar `createOrUpdateKiwifyCRMContact` e `createOrUpdateCRMContact` (Hubla) para usar a mesma rotina compartilhada `ensureContactAndDeal(supabase, payload)`:

- Busca contato: email → phone (sufixo 9 dígitos) → captura `duplicate_contact:phone:<uuid>` do trigger.
- Cria contato sempre com `name`, `email`, `phone` (gera placeholder `noemail+<hubla_id>@mcf.local` se faltar email; usa `0000000000` se faltar phone — marca `needs_review=true` em `custom_fields`).
- Cria deal sempre — sem deal não há registro. Se falhar criação, enfileira para retry (ver 1.3).

**1.2** Eliminar todos os `return { dealId: null }` silenciosos. Cada falha:
- Loga em nova tabela `webhook_ingest_failures` (hubla_id, source, payload, motivo, attempts, last_error).
- Webhook ainda devolve 200 (não fazer Kiwify/Hubla reenviar), mas a falha fica visível.

**1.3** Tabela + cron: `webhook_ingest_failures` com job a cada 5 min que tenta `ensureContactAndDeal` para cada linha pendente (max 5 tentativas, exponential backoff).

**1.4** Garantir `linked_deal_id` em **todos** os caminhos de criação:
- `kiwify-webhook-handler`: já corrigido em iteração anterior — confirmar 4 paths.
- `hubla-webhook-handler`: já tem (linhas 1572/1694/2399/2435).
- `clint-webhook-handler`: adicionar bloco que insere/upsert `hubla_transactions` quando o payload é A010 vindo de Kiwify (usar `kiwify_order_id` como `hubla_id = 'kiwify_' + order_id`) e popula `linked_deal_id`.
- `kiwify-backfill-a010-csv`: adicionar mesmo upsert.

### Camada 2 — Relatório por união, não interseção

Mudar `get_all_hubla_transactions` (RPC) para **UNION** de:
- `hubla_transactions` com `linked_deal_id` (caminho normal).
- `crm_deals` tag A010 sem transação correspondente (caminho legacy/backfill) — sintetizando linha virtual com `source='legacy'`.

Resultado: relatório nunca perde compra. Apresenta segregação por `source` no UI (Kiwify / Hubla / Legacy / Backfill).

### Camada 3 — Reconciliação diária + alerta

**3.1** Edge function `daily-a010-reconcile` (cron diário 06:00):
- Conta `hubla_transactions` pagas A010 do dia anterior.
- Conta `crm_deals` A010 do dia anterior.
- Se divergir > 0 → cria registro em `alertas` com nível `high` e detalha hubla_ids órfãos.

**3.2** Página `/crm/webhook-analytics` ganha card "Compras sem deal nas últimas 24h" usando `webhook_ingest_failures` + reconcile. Botão "Reprocessar" chama `kiwify-recover-orphan-transactions` (já criado).

**3.3** Trigger pg em `hubla_transactions`: se `sale_status='completed'` por > 30 min e `linked_deal_id IS NULL`, insere em `alertas`.

---

## Detalhes técnicos

### Nova migration

```sql
CREATE TABLE public.webhook_ingest_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,         -- 'kiwify' | 'hubla' | 'clint'
  hubla_id text,
  customer_email text,
  customer_phone text,
  customer_name text,
  raw_payload jsonb NOT NULL,
  failure_reason text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  resolved_at timestamptz,
  resolved_deal_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.webhook_ingest_failures TO authenticated;
GRANT ALL ON public.webhook_ingest_failures TO service_role;
ALTER TABLE public.webhook_ingest_failures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins view" ON public.webhook_ingest_failures FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
```

### Helper compartilhado

Criar `supabase/functions/_shared/ensureContactAndDeal.ts`:

```ts
export async function ensureContactAndDeal(supabase, p: {
  source: 'kiwify'|'hubla'|'clint',
  hubla_id: string,
  email?: string, phone?: string, name?: string,
  product_name: string, value: number, sale_date: string,
}): Promise<{ dealId: string|null, contactId: string|null, reason?: string }>
```

Reusar pela `kiwify-webhook-handler`, `hubla-webhook-handler`, `clint-webhook-handler`, `kiwify-backfill-a010-csv`, `kiwify-recover-orphan-transactions`.

### RPC modificada

```sql
CREATE OR REPLACE FUNCTION public.get_all_hubla_transactions(p_start date, p_end date)
RETURNS TABLE(...) AS $$
  SELECT ... FROM hubla_transactions ht
  LEFT JOIN crm_deals d ON d.id = ht.linked_deal_id
  WHERE ht.sale_date BETWEEN p_start AND p_end
  UNION ALL
  SELECT ... FROM crm_deals d
  LEFT JOIN crm_contacts c ON c.id = d.contact_id
  WHERE d.created_at::date BETWEEN p_start AND p_end
    AND 'A010' = ANY(d.tags)
    AND NOT EXISTS (SELECT 1 FROM hubla_transactions ht WHERE ht.linked_deal_id = d.id)
$$ LANGUAGE sql STABLE;
```

### Cron retry

```sql
SELECT cron.schedule('retry-webhook-failures', '*/5 * * * *', $$
  SELECT net.http_post(
    url := 'https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/retry-webhook-failures',
    headers := '{"Content-Type":"application/json","apikey":"<anon>"}'::jsonb,
    body := '{}'::jsonb
  );
$$);
```

---

## Entregáveis por fase

**Fase A (essencial — corrige o sangramento)**
1. Migration `webhook_ingest_failures`.
2. Helper `_shared/ensureContactAndDeal.ts`.
3. Patch `kiwify-webhook-handler` para nunca dropar silenciosamente (log → failures).
4. Patch `hubla-webhook-handler` idem.
5. Patch `clint-webhook-handler` para escrever em `hubla_transactions` + `linked_deal_id`.
6. Edge function `retry-webhook-failures` + cron 5 min.

**Fase B (alinha relatório)**
7. Modificar RPC `get_all_hubla_transactions` para UNION com deals legacy.
8. Patch `kiwify-backfill-a010-csv` para criar linha em `hubla_transactions`.

**Fase C (visibilidade)**
9. Edge function `daily-a010-reconcile` + cron.
10. Card "Compras sem deal nas últimas 24h" em `/crm/webhook-analytics`.
11. QA doc final.

## Fora de escopo

- Migrar `clint-webhook-handler` para deprecação total (separar tarefa).
- Reescrever pipeline de Hubla offers que não são A010.
- UI nova de moderação manual das falhas (Fase D futura).

## Perguntas antes de executar

1. Posso assumir placeholders (`noemail+<id>@mcf.local`, phone `0000000000`) para compras sem email/phone? Ou prefere bloquear e mandar pra moderação?
2. Fase A pode rodar hoje + cron, ou prefere implementar tudo (A+B+C) de uma vez?
3. O alerta "compras sem deal" deve disparar email/push ou só aparecer no painel?
