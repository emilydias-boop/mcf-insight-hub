
# Plano: Corrigir Data de Pagamento no Webhook da Hubla

## Problema Identificado

O webhook `hubla-webhook-handler` marca contratos como pagos, mas usa a **data da reunião** (`meeting.scheduled_at`) em vez da **data real do pagamento** (`data.saleDate` que vem da Hubla).

**Evidência no banco:**
| Cliente | contract_paid_at (Agenda) | sale_date (Hubla) | Diferença |
|---------|--------------------------|-------------------|-----------|
| André | 03/02 19:00 | 04/02 21:19 | 1 dia |
| Israel Anijar | 03/02 17:00 | 04/02 19:30 | 1 dia |
| Henrique | NULL | 04/02 14:25 | Sem data |

Isso explica a discrepância: **9 contratos** na agenda vs **11 na Hubla** para hoje.

---

## Arquivo a Modificar

| Arquivo | Linha | Alteração |
|---------|-------|-----------|
| `supabase/functions/hubla-webhook-handler/index.ts` | 770 | `meeting.scheduled_at` → `data.saleDate` |

---

## Código Atual (Linha 770)

```typescript
.update({
  status: 'contract_paid',
  contract_paid_at: meeting.scheduled_at // ← ERRADO: usa data da reunião
})
```

## Código Corrigido

```typescript
.update({
  status: 'contract_paid',
  contract_paid_at: data.saleDate // ← CORRETO: usa data real do pagamento Hubla
})
```

---

## Impacto

1. **Novos contratos** serão marcados com a data real do pagamento
2. **Follow-ups** serão corretamente atribuídos ao mês do pagamento, não da reunião
3. **Métricas de Closer** terão contagem precisa de contratos por período

---

## Correção de Dados Históricos (Opcional)

Após a correção do webhook, podemos criar um script para atualizar os registros antigos:

```sql
-- Atualizar contract_paid_at com a data real da Hubla para registros existentes
UPDATE meeting_slot_attendees msa
SET contract_paid_at = ht.sale_date
FROM hubla_transactions ht
WHERE msa.status = 'contract_paid'
  AND ht.product_category = 'contrato'
  AND ht.linked_attendee_id = msa.id
  AND msa.contract_paid_at != ht.sale_date;
```

---

## Resumo

- **1 linha** de código alterada
- **Zero breaking changes**
- Alinha comportamento do webhook com a lógica do hook `useCloserAgendaMetrics` que já usa `contract_paid_at`
