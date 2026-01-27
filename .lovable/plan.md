
# Plano: Corrigir Inconsistências nos KPIs do R2 Carrinho

## Problemas Identificados

### 1. Contratos (R1): KPI mostra 7, realidade são 11

| Fonte | Lógica | Resultado |
|-------|--------|-----------|
| **KPI atual** | Conta attendees `contract_paid` em R1s **agendados na semana** | 7 |
| **Aba Vendas MCF** | Conta transações A000 **pagas na semana** | 11 clientes únicos |

**Causa raiz:** O KPI usa a data da **reunião R1**, não a data do **pagamento do contrato**. Se um cliente fez R1 na semana passada mas pagou contrato esta semana, ele não aparece no KPI.

### 2. R2 Agendadas: KPI mostra 46, aba mostra 29

| Fonte | Lógica | Resultado |
|-------|--------|-----------|
| **KPI atual** | Conta **meeting_slots** R2 não cancelados | 46 slots |
| **Aba R2 Agendadas** | Conta **attendees** em slots com status `scheduled/invited/pending` | 29 attendees |

**Causa raiz:** O KPI conta slots (reuniões), a aba conta attendees (participantes). Uma reunião pode ter múltiplos participantes, mas o filtro da aba exclui `completed` e `no_show`.

---

## Solução Proposta

### Mudança 1: Corrigir KPI "Contratos (R1)"

Alterar a lógica para contar **transações A000 (Contrato) pagas na semana** diretamente da tabela `hubla_transactions`, consolidando por cliente único:

```sql
-- Nova lógica para Contratos
SELECT COUNT(DISTINCT customer_email) as contratos_pagos
FROM hubla_transactions
WHERE product_name LIKE '%A000%' 
  AND product_category = 'incorporador'
  AND sale_date >= weekStart
  AND sale_date <= weekEnd
```

**Benefícios:**
- Consistente com a aba "Vendas MCF Incorporador"
- Conta contratos **efetivamente pagos** na semana, não pela data da R1

### Mudança 2: Alinhar KPI "R2 Agendadas" com a aba

Duas opções:

**Opção A (Recomendada):** Mudar o KPI para contar **attendees** (igual à aba):
- KPI mostrará o mesmo número que a aba (29)
- Métrica mais relevante: "quantos leads estão agendados para R2"

**Opção B:** Renomear o KPI para "Reuniões R2" e criar um novo KPI "Leads R2 Agendados"
- Mantém o comportamento atual (46 reuniões)
- Adiciona clareza sobre o que está sendo contado

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useR2CarrinhoKPIs.ts` | Refatorar cálculo de `contratosPagos` e `r2Agendadas` |

---

## Detalhes Técnicos

### Nova lógica para `contratosPagos`:

```typescript
// Buscar contratos A000 pagos na semana (por data de pagamento)
const { data: contratosTx } = await supabase
  .from('hubla_transactions')
  .select('customer_email')
  .ilike('product_name', '%A000%')
  .eq('product_category', 'incorporador')
  .gte('sale_date', startOfDay(weekStart).toISOString())
  .lte('sale_date', endOfDay(weekEnd).toISOString());

// Contar clientes únicos (deduplicar)
const uniqueContracts = new Set(
  (contratosTx || []).map(tx => tx.customer_email?.toLowerCase()).filter(Boolean)
);
const contratosPagos = uniqueContracts.size;
```

### Nova lógica para `r2Agendadas` (alinhada com aba):

```typescript
// Contar attendees (não slots) em R2s agendados
const { count: r2Agendadas } = await supabase
  .from('meeting_slot_attendees')
  .select('id', { count: 'exact', head: true })
  .eq('meeting_slots.meeting_type', 'r2')
  .in('meeting_slots.status', ['scheduled', 'invited', 'pending'])
  .gte('meeting_slots.scheduled_at', startOfDay(weekStart).toISOString())
  .lte('meeting_slots.scheduled_at', endOfDay(weekEnd).toISOString());
```

---

## Resultado Esperado

| KPI | Antes | Depois |
|-----|-------|--------|
| Contratos (R1) | 7 | 11 (igual à aba Vendas) |
| R2 Agendadas | 46 | 29 (igual à aba R2 Agendadas) |

Ambos os KPIs ficarão consistentes com suas respectivas abas/páginas de origem.
