## Objetivo

Garantir que todo comprador A010 (qualquer parcela) e todo contrato Outside entrem no `PIPELINE INSIDE SALES` com SDR atribuído, eliminando os "leads órfãos" como o do Gabriel.

## Causas raiz confirmadas

1. **A010 parcelado não gera deal** — `hubla-webhook-handler` só cria deal em Inside Sales quando `installment === 1`. Quem compra em parcela > 1 (ou tem evento da 2ª+ cobrança chegando antes da 1ª) nunca entra no funil.
2. **Contrato Outside sem deal prévio fica órfão** — `hubla-webhook-handler` (e `webhook-make-contrato`) só distribuem o contrato quando já existe deal em Inside Sales. Se o A010 não criou deal (causa 1) ou se o cliente veio direto pelo Outside, o `Contrato Perfil A - Vitrine A010` é registrado em `hubla_transactions` mas nenhum SDR é atribuído.

## Mudanças

### 1. `supabase/functions/hubla-webhook-handler/index.ts` — A010

- Remover a condição `installment === 1` para criação de deal A010.
- Antes de criar, fazer dedupe: procurar deal existente no `PIPELINE INSIDE SALES` pelo `contact_id` (já normalizado por email + telefone). Se existir, só anexa a transação; se não, cria.
- Se for parcela > 1 e não houver deal, criar mesmo assim (cliente real, comprou A010) e logar `source: 'a010_late_installment'` para auditoria.
- Distribuir via `get_next_lead_owner` (mesma chamada já usada hoje).

### 2. `supabase/functions/hubla-webhook-handler/index.ts` — Outside (`Contrato Perfil A - Vitrine A010` e `Contrato - Curso R$ 97,00`)

Quando `invoice.payment_succeeded` chega com `offer_name` ∈ `OUTSIDE_OFFER_NAMES`:

- Procurar contato por email/telefone (criar se não existir, com `source: 'hubla_outside'`).
- Procurar deal em `PIPELINE INSIDE SALES`:
  - **Se existir**: aplicar fluxo atual (tag `Outside`, mover para `Contrato Pago`, vincular transação).
  - **Se não existir**: criar deal novo, distribuir SDR via `get_next_lead_owner`, tag `Outside`, stage `Contrato Pago` (fallback `Novo Lead` se a stage não existir), vincular transação.
- Logar resultado em `hubla_webhook_logs` com `action: 'outside_deal_created'` ou `'outside_deal_linked'`.

### 3. `supabase/functions/webhook-make-contrato/index.ts`

Aplicar exatamente a mesma lógica do item 2 para garantir paridade com o caminho Make.

### 4. `supabase/functions/distribute-outside-leads/index.ts`

Hoje só detecta e relata órfãos. Estender para, em modo `repair: true`:

- Buscar `hubla_transactions` Outside dos últimos 60 dias sem deal correspondente em Inside Sales.
- Para cada um, executar o mesmo fluxo do item 2 (criar contato se faltar, criar deal, distribuir SDR, tag Outside, stage Contrato Pago).
- Servir como rotina de saneamento (pode rodar manual ou via cron).

### 5. Reparo do caso Gabriel (`gabrielarthurrei@gmail.com`)

Após o deploy das funções, executar o `distribute-outside-leads` em modo `repair` (ou um INSERT pontual via supabase--insert) para:

- Criar deal em `PIPELINE INSIDE SALES` com `contact_id = 616536b5-fdf4-4609-8b57-52ee0d54f229`.
- Distribuir para o próximo SDR de Inside Sales via round-robin.
- Tag `Outside`, stage `Contrato Pago`.
- Vincular as `hubla_transactions` do A010 (15/mai) e Contrato (12/jun).

### 6. Validação

- Reprocessar (ou consultar via SQL) o Gabriel: deve ter 1 deal em Inside Sales com `owner_id` preenchido.
- Logs de `hubla-webhook-handler` devem mostrar `outside_deal_created` em vez de "Nenhum deal encontrado".
- Conferir que não há duplicação quando Hubla + Make disparam para o mesmo contrato (mesmo `contact_id` ⇒ mesmo deal).
- Atualizar `mem://integration/webhook-lead-receiver-hubla-normalization` (ou criar novo memo) registrando: A010 cria deal em qualquer parcela; Outside sem deal cria + distribui.

## Detalhes técnicos

- Dedupe de deal: `SELECT id FROM crm_deals WHERE contact_id = $1 AND origin_id = (PIPELINE INSIDE SALES) LIMIT 1`.
- SDR: `supabase.rpc('get_next_lead_owner', { p_origin_id: INSIDE_SALES_ORIGIN_ID })`.
- Stage `Contrato Pago` resolvida via `crm_stages` pelo `origin_id` e nome exato (respeitando memo `crm-stage-sync-naming-convention`).
- Inside Sales não recebe leads de parceiros (memos `hubla-routing-collision-logic-v5` e `partner-renewal-block-logic`): manter os bloqueios atuais de produtos A001-A009/R001 — só A010 e Outside puro entram.
- Idempotência: usar `hubla_id` da transação para não duplicar vínculos em reprocessamentos.
