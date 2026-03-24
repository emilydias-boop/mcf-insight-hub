

## Investigação: 12 transações vs 10 no painel (9 contratos + 1 outside)

### Como o KPI "Contratos" é calculado

```text
closerMetrics (useR1CloserMetrics)
  ↓
contrato_pago = meeting_slot_attendees WHERE contract_paid_at IS NOT NULL
               AND contract_paid_at >= dia AND contract_paid_at <= dia
               AND meeting_type = 'r1' AND is_partner = false
               AND contract_paid_at >= scheduled_at (senão é Outside)

outside = hubla_transactions com sale_date < scheduled_at da R1

KPI "Contratos" = contrato_pago (exclui Outside)
KPI "Outside" = outside
Total visível = contrato_pago + outside = 10
```

### O que está faltando

| Contagem | Valor |
|----------|-------|
| Transações Hubla dia 23/03 | 12 |
| Recorrências (P2+) | -1 |
| Primeiras parcelas esperadas | **11** |
| Com `meeting_slot_attendee` vinculado (`contract_paid_at` preenchido) | **10** |
| **Faltando** | **1** |

### Causa provável

Existe 1 transação de contrato do dia 23/03 cujo `linked_attendee_id` é NULL — ou seja, o webhook de auto-match não conseguiu vincular a um attendee R1. Sem vínculo, o `contract_paid_at` nunca é preenchido no attendee, e o contrato não aparece no KPI.

### Ação necessária

Para identificar e corrigir, preciso:

1. **Consultar o banco** para encontrar a transação específica sem vínculo:
   ```sql
   SELECT id, customer_name, customer_email, customer_phone, product_name
   FROM hubla_transactions
   WHERE sale_date >= '2026-03-23T03:00:00' AND sale_date < '2026-03-24T03:00:00'
     AND product_category IN ('contrato', 'incorporador')
     AND (installment_number = 1 OR installment_number IS NULL)
     AND linked_attendee_id IS NULL;
   ```

2. **Vincular manualmente** essa transação ao attendee correto via a interface "Vincular Contrato" na agenda do closer, ou via SQL migration.

### Preciso de aprovação

Para executar essa query no banco e identificar qual transação está faltando. Posso então fazer a vinculação via migration SQL ou indicar para vincular pela interface.

