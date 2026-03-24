

## Diagnóstico: 12 transações vs 9+1 no painel

### Como funciona hoje

O KPI "Contratos" = `totalContratos - totalOutside` = `10 - 1 = 9`. O "Outside" mostra `1`. Total real contado pelo sistema = **10**.

O sistema conta contratos a partir de `meeting_slot_attendees` onde `contract_paid_at IS NOT NULL` (hook `useR1CloserMetrics`). Se uma transação Hubla **não foi vinculada** a um attendee R1, ela simplesmente não é contada.

### O que está faltando

Dos 12 transações Hubla nesse dia:
- 1 é recorrência (P2) → não deveria contar → restam **11**
- 10 foram vinculadas a attendees R1 → aparecem no painel
- **1 transação não foi vinculada** a nenhum attendee R1

Essa transação perdida é provavelmente um caso similar ao do Felipe: o `hubla-webhook-handler` não conseguiu fazer match por email/telefone/nome com um `meeting_slot_attendee`, então o `contract_paid_at` nunca foi preenchido.

### Plano de investigação e correção

#### 1. Identificar a transação não vinculada
Consultar o banco para encontrar qual transação de 23/03 com `installment_number = 1` não tem `linked_attendee_id` correspondente. Comparar com os attendees R1 do dia para identificar o match manual necessário.

#### 2. Verificar logs do webhook
Consultar os logs do `hubla-webhook-handler` para entender por que o auto-match falhou nesse caso específico.

#### 3. Ação imediata
Vincular manualmente a transação ao attendee correto via a interface de "Vincular Contrato" na agenda do closer, ou via SQL migration.

### Detalhes técnicos

| Verificação | Query |
|-------------|-------|
| Transações do dia 23/03 sem vínculo | `hubla_transactions` where `sale_date` = 23/03, `installment_number = 1`, `product_category IN ('contrato','incorporador')`, `linked_attendee_id IS NULL` |
| Attendees R1 do dia sem contract_paid_at | `meeting_slot_attendees` com R1 meetings de 23/03 onde `contract_paid_at IS NULL` e `status != 'contract_paid'` |

### Resumo

| Contagem | Valor |
|----------|-------|
| Transações Hubla dia 23/03 | 12 |
| Menos recorrências (P2+) | -1 |
| Total esperado | 11 |
| Vinculadas (KPI mostra) | 10 (9 contratos + 1 outside) |
| Faltando | 1 (não vinculada automaticamente) |

A solução é identificar e vincular manualmente essa transação, ou executar a "Limpeza Completa" caso seja mais um caso de contato duplicado.

