

## Auto-popular Cobranças com dados da Hubla

### Dados disponíveis

Sim, a Hubla envia dados de **boleto** (`bank_slip`), **cartão** (`credit_card`) e **PIX** parcelado. A tabela `hubla_transactions` já tem:

- **1.498 assinaturas parceladas** únicas (combinação cliente + produto)
- **1.836 registros de parcelas** pagas (event_type = `invoice.payment_succeeded`)
- Cada registro tem `installment_number`, `total_installments`, `product_price`, `net_value`, `payment_method`, `sale_date`
- Boleto: 13 parcelas de 10 clientes | Cartão: 1.795 parcelas de 953 clientes | PIX parcelado: 26 parcelas de 17 clientes

### Plano de implementação

**1. Edge Function `sync-billing-from-hubla`**

Cria uma edge function que lê `hubla_transactions` parceladas e popula automaticamente as tabelas de billing:

- Agrupa por `customer_email + product_name` para criar uma `billing_subscription` por contrato
- Para cada assinatura, cria `billing_installments` (1 a `total_installments`)
  - Parcelas já pagas na Hubla: status `pago`, com `data_pagamento`, `valor_pago`, `hubla_transaction_id`
  - Parcelas futuras sem registro: status `pendente`, com `data_vencimento` estimada (baseada no intervalo entre parcelas existentes)
  - Parcelas vencidas sem registro: status `atrasado`
- Calcula `valor_total_contrato` = `product_price * total_installments`
- Define `status` da assinatura: `em_dia`, `atrasada` ou `quitada` conforme parcelas pagas vs total
- Define `status_quitacao`: `quitado` se todas pagas, `parcialmente_pago` se algumas, `em_aberto` se nenhuma
- Usa upsert para não duplicar em execuções repetidas (chave: `customer_email + product_name + sale_date da primeira parcela`)

**2. Botão "Sincronizar com Hubla" na página**

- Adicionar botão na página `/cobrancas` ao lado de "Nova Assinatura"
- Chama a edge function e mostra progresso/resultado
- Permite re-sincronizar para pegar novas parcelas pagas

**3. Webhook automático (futuro)**

- Quando o `hubla-webhook-handler` recebe `invoice.payment_succeeded` de parcela, atualizar automaticamente o `billing_installment` correspondente

### Detalhes da sincronização

```text
hubla_transactions (parcelada)          →  billing_subscriptions
─────────────────────────────────────      ───────────────────
customer_email + product_name (grupo)  →  1 subscription
product_price * total_installments     →  valor_total_contrato
payment_method                         →  forma_pagamento
min(sale_date) do grupo                →  data_inicio

hubla_transactions (cada parcela)       →  billing_installments
─────────────────────────────────────      ───────────────────
installment_number                     →  numero_parcela
net_value                              →  valor_pago + valor_liquido
product_price                          →  valor_original
sale_date                              →  data_pagamento
id                                     →  hubla_transaction_id
```

### Arquivos

| Acao | Arquivo |
|------|---------|
| Criar | `supabase/functions/sync-billing-from-hubla/index.ts` |
| Editar | `src/components/financeiro/cobranca/FinanceiroCobrancas.tsx` — botao sincronizar |
| Criar | `src/hooks/useSyncBillingFromHubla.ts` — hook para chamar a edge function |

