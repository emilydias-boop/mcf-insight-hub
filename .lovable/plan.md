## Reconciliação diária Kiwify (A010)

Agora que o token da API Kiwify foi criado, posso implementar a reconciliação automática que recupera vendas A010 que não chegaram pelo webhook em tempo real.

### O que será criado

**1. Secrets (vou pedir após aprovação)**
- `KIWIFY_CLIENT_ID`
- `KIWIFY_CLIENT_SECRET`
- `KIWIFY_ACCOUNT_ID` (se necessário pela API)

**2. Edge function `kiwify-daily-reconcile`**
- Autentica via OAuth2 `client_credentials` na Kiwify
- Busca vendas dos **últimos 3 dias** em `GET /v1/sales` (janela de tolerância para atrasos)
- Para cada venda **paga/aprovada** que ainda não existe em `hubla_transactions` (chave: `order_id`):
  - Insere a transação usando a **mesma normalização** do webhook em tempo real (telefone, email lowercase, mapeamento de offer→produto)
  - Cria/atualiza `crm_deals` em PIPELINE INSIDE SALES com `created_at = sale_date` (não `now()`) para preservar a data real da venda
  - Respeita `prevent_duplicate_crm_contact` (email + telefone 9 dígitos)
  - Bloqueia produtos parceiros/renovação (A001-A009, R001, etc.)
- Loga cada execução em `hubla_webhook_logs` com `event_type='kiwify:reconcile'` e contagem de recovered/skipped/errors

**3. Refatoração compartilhada**
- Extrair a lógica de insert + normalização para `supabase/functions/_shared/kiwify-ingest.ts`
- Webhook em tempo real e reconciliador passam a usar a mesma função → garante paridade

**4. Cron job (`pg_cron` + `pg_net`)**
- Agenda: `0 6 * * *` (03:00 BRT = 06:00 UTC)
- Chama a edge function via `net.http_post`

**5. Dashboard `/diagnostico/kiwify-reconcile`**
- Última execução (timestamp + status)
- Contadores 24h / 7d (recovered, skipped, errors)
- Tabela das 20 recuperações mais recentes (order_id, email, produto, sale_date, deal criado)
- Botão "Executar agora" (admin only)

### Fora de escopo (fica para depois)
- Alerta Brevo quando >N recuperações em 24h (sinal de webhook quebrado)
- Investigação da causa raiz do webhook Kiwify não chegar
- Reconciliação equivalente para Hubla

### Pré-requisito
Confirmar que o token criado tem escopo **Vendas** (e Reembolsar vendas, se quiser cobrir estornos no mesmo job — opcional).
