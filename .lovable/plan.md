
# Integração CRM ↔ MCF Pay

## 1. O que encontrei no schema atual (validação antes de codar)

**`crm_deals`** (campos relevantes):
- `id` (uuid) → será o `crm_deal_id` enviado no webhook.
- `stage_id` (uuid) → FK para `crm_stages`.
- `owner_id` (text), `owner_profile_id` (uuid).
- `original_sdr_email` (text), `r1_closer_email` (text), `r2_closer_email` (text) → já temos identificação de SDR e Closer por e-mail.
- `custom_fields` (jsonb) e `tags` (array) → podem absorver overrides.

**`crm_stages`**: o stage final tem vários nomes ("Fechado", "Contrato Pago", "Contrato na Mão", "Contrato Consórcio", "PRODUTOS FECHADOS", "CONTRATO PAGO", "SELECT - Parceiro Pagou", "PARCELINHA - MCF Pagou") — varia por pipeline/BU. **Não existe um campo único `status` no deal**; o "ganho" é derivado do `stage_id` apontando para um desses stages.

**`profiles`**: não tem `mcf_pay_code` hoje. Tem `id`, `email`, `full_name`.

**`hubla_transactions`**: tem `customer_email`, `hubla_id`, mas **não tem `asaas_payment_id`** explicitamente. Existe `asaas-webhook-handler` (edge function), então o ID do Asaas pode ser obtido de outro lugar — por ora, o webhook vai **omitir** `purchase_ref.asaas_payment_id` e o MCF Pay casa só pelo `crm_deal_id`.

## 2. Decisões propostas (preciso da sua confirmação)

### 2.1. Gatilho do disparo
**Recomendação:** disparar quando o `stage_id` mudar para um stage marcado como "ganho". Implementação:
- Adicionar coluna booleana `is_won_stage` em `public.crm_stages` (default false).
- Marcar como `true` todos os stages cujo nome corresponde aos padrões acima (uma vez, via migration).
- Trigger `AFTER UPDATE OF stage_id ON crm_deals`: se o novo stage tem `is_won_stage = true` e o anterior não, enfileira o webhook.
- Isso resolve "qual é o status fechado" sem depender de string-match em runtime e é facilmente ajustável pela UI no futuro.

### 2.2. Onde guardar `closer_code` e `sdr_code`
**Recomendação:** novas colunas em `public.profiles`:
- `mcf_pay_closer_code text` (nullable, único quando preenchido)
- `mcf_pay_sdr_code text` (nullable, único quando preenchido)

E **override opcional por deal** dentro de `crm_deals.custom_fields` (`mcf_pay_closer_code`, `mcf_pay_sdr_code`) para casos especiais — sem precisar de DDL nova no deal.

Resolução no momento do disparo:
1. `closer_code`: override no `custom_fields` → senão profile do `r2_closer_email` → senão profile do `r1_closer_email` → senão profile do `owner_profile_id`.
2. `sdr_code`: override no `custom_fields` → senão profile do `original_sdr_email`.

Se ambos vierem nulos, o registro vai para `mcf_pay_dispatch_logs` com status `skipped_no_codes` e **não** é enviado.

## 3. Entregáveis

### 3.1. Banco (1 migration)
- `ALTER TABLE public.profiles ADD COLUMN mcf_pay_closer_code text, ADD COLUMN mcf_pay_sdr_code text` (+ índices únicos parciais).
- `ALTER TABLE public.crm_stages ADD COLUMN is_won_stage boolean NOT NULL DEFAULT false` + UPDATE marcando os stages conhecidos.
- `CREATE TABLE public.mcf_pay_dispatch_logs` (id, deal_id, attempt, status [`pending|success|failed|skipped_no_codes`], http_status, payload jsonb, response jsonb, signature_preview, next_retry_at, error_message, created_at) + GRANTs (`authenticated` SELECT, `service_role` ALL) + RLS (admins/coordenadores leem; insert apenas service_role) + índices.
- `CREATE TABLE public.mcf_pay_config` (singleton: id boolean primary key default true, webhook_url text, is_active boolean, updated_by, updated_at) + GRANTs + RLS (apenas admins). O secret **não** vai aqui.
- Trigger `AFTER UPDATE OF stage_id ON crm_deals` → `pg_net.http_post` para a edge function `notify-mcf-pay` (modo "enqueue") quando entra num stage com `is_won_stage = true`.

### 3.2. Secret
- `MCF_PAY_WEBHOOK_SECRET` registrado via `add_secret` (você cola o valor quando o MCF Pay estiver pronto).

### 3.3. Edge Function `notify-mcf-pay`
Aceita dois modos:
- **`{ deal_id, attempt }`** → busca o deal, monta o payload conforme contrato (`event: "deal.paid"`, `crm_deal_id`, `closer_code`, `sdr_code`, `purchase_ref` omitido por enquanto), serializa **uma vez** o body raw, assina HMAC-SHA256 hex e envia POST com `x-crm-signature`.
- **`{ test: true }`** → envia payload de exemplo com `crm_deal_id: "test-<uuid>"`.

Lógica de resposta:
- HTTP 200 + `ok:true` → log `success`.
- HTTP 200 + `ok:false` com `reason in ("purchase_not_found_yet","purchase_not_paid_yet")` → log `pending`, agenda próximo retry (5min → 30min → 2h; após 3 falhas vira `failed`).
- HTTP 400 com `error:"Assinatura inválida"` → log `failed`, **sem retry**.
- Outros erros / timeout → conta como retry.

Retries: cron `pg_cron` a cada 5 minutos invoca `notify-mcf-pay` com `{ retry_queue: true }`, que processa logs com `status='pending'` e `next_retry_at <= now()`.

### 3.4. Frontend — `Configurações > Integrações > MCF Pay`
Nova página em `src/pages/admin/IntegracaoMcfPay.tsx` + entrada na sidebar (área de admin), contendo:
- Input "URL do webhook MCF Pay" + toggle "Ativo" → grava em `mcf_pay_config`.
- Aviso: "Secret armazenado com segurança como `MCF_PAY_WEBHOOK_SECRET`" + link para Edge Function Secrets.
- Botão **Enviar teste** → invoca `notify-mcf-pay` com `{ test: true }` e mostra o resultado.
- Tabela "Últimos 20 envios" lendo `mcf_pay_dispatch_logs` (deal, status, http_status, criado_em, último erro) com botão **Reenviar** (chama a edge function com `{ deal_id, force: true }`).
- Sub-seção "Mapeamento de códigos" com link para a tela de Gerenciamento de Usuários, onde adicionarei dois campos novos (`mcf_pay_closer_code`, `mcf_pay_sdr_code`) no `UserTargetsForm` ou em um formulário separado.

### 3.5. UI auxiliar
- Em `src/components/user-management/`: novo card "Códigos MCF Pay" para editar os dois campos por usuário (apenas admin).

## 4. O que **não** vou fazer agora
- Não vou puxar `asaas_payment_id` (não está mapeado no schema do CRM hoje). Quando você apontar onde ele vive, eu incluo no `purchase_ref`.
- Não vou tocar nos webhooks Hubla/Asaas existentes.

## 5. Perguntas antes de codar
1. **Confirma o gatilho** = "stage do deal entra em `is_won_stage = true`"? Ou prefere disparar também quando algum status externo (ex.: `hubla_transactions.sale_status = 'completed'` ligado ao deal) virar pago?
2. **Lista de stages "ganho"**: posso marcar automaticamente todos com nome em (`Fechado`, `Contrato Pago`, `Contrato na Mão`, `Contrato Consórcio`, `PRODUTOS FECHADOS`, `CONTRATO PAGO`, `SELECT - Parceiro Pagou`, `PARCELINHA - MCF Pagou`) — ou quer revisar essa lista antes?
3. **Escopo por BU**: integrar com **todos** os pipelines/BUs ou só uma BU específica (ex.: Incorporador)? Posso adicionar uma flag por `crm_origins` se for o caso.

Assim que você responder essas 3 perguntas, executo a migration + edge function + UI numa única leva.
