

## Plano: Backfill do billing_history para parcelas já pagas

### Problema
A tabela `billing_history` tem 0 registros. O código de inserção no sync foi adicionado **depois** que todas as parcelas já estavam sincronizadas como `pago`. O sync só gera histórico para parcelas recém-detectadas como pagas, não para as que já existiam.

### Solução
Criar uma migration SQL que faz backfill: para cada `billing_installment` com `status = 'pago'`, inserir um registro em `billing_history` se ainda não existir.

### Mudanças

**1. Migration SQL (backfill)**

Inserir em `billing_history` a partir de `billing_installments` com `status = 'pago'`:
- `subscription_id` da parcela
- `tipo`: `'parcela_paga'`
- `valor`: `valor_pago`
- `responsavel`: `'Sistema (Hubla Sync)'`
- `descricao`: `'Parcela X/Y paga via Hubla (backfill)'` — usando `numero_parcela` e `total_parcelas` da subscription
- `created_at`: `data_pagamento` da parcela
- `metadata`: `{ hubla_transaction_id, numero_parcela, backfill: true }`
- Condição: apenas onde não existe registro duplicado em `billing_history` para mesma `subscription_id` + `numero_parcela`

### Resultado
Após a migration, o Histórico de qualquer assinatura mostrará todas as parcelas já pagas com data e valor corretos. Novos pagamentos continuarão sendo registrados automaticamente pelo sync.

### Arquivo

| Arquivo | Mudança |
|---------|---------|
| `supabase/migrations/backfill_billing_history.sql` | INSERT INTO billing_history FROM billing_installments WHERE status='pago' |

