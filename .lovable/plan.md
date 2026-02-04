
# Plano: Corrigir Contagem de Contratos por Data de Pagamento

## Problema Identificado

O hook `useCloserAgendaMetrics.ts` (usado para Closers no painel de fechamento) conta contratos pagos baseado na **data da reunião** (`scheduled_at`), não na **data do pagamento** (`contract_paid_at`).

**Cenário atual problemático:**
- Reunião R1 acontece em **Janeiro**
- Lead fecha contrato em **Fevereiro** (follow-up)
- Sistema conta o contrato em **Janeiro** (errado)
- Deveria contar em **Fevereiro** (data real da venda)

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useCloserAgendaMetrics.ts` | Separar query de contratos, usar `contract_paid_at` |

## Solução Técnica

Atualmente o hook faz uma única query filtrando por `scheduled_at` e conta todos os attendees com status `contract_paid`:

```typescript
// ANTES (Linhas 64-76, 102-105)
const { data: slots } = await supabase
  .from('meeting_slots')
  .select(...)
  .gte('scheduled_at', `${startDate}...`)  // <-- Problema: usa data da reunião
  .lte('scheduled_at', `${endDate}...`);

// Conta contratos das reuniões do período
if (['contract_paid', 'refunded'].includes(status)) {
  contratos_pagos++;  // <-- Conta no mês da reunião, não do pagamento
}
```

**Solução:** Fazer query separada para contratos usando `contract_paid_at`:

```typescript
// DEPOIS: Query separada para contratos por data de pagamento
const { data: contractsByPaymentDate } = await supabase
  .from('meeting_slot_attendees')
  .select(`
    id,
    status,
    contract_paid_at,
    meeting_slot:meeting_slots!inner(closer_id)
  `)
  .eq('meeting_slot.closer_id', closerId)
  .in('status', ['contract_paid', 'refunded'])
  .not('contract_paid_at', 'is', null)
  .gte('contract_paid_at', `${startDate}T00:00:00`)
  .lte('contract_paid_at', `${endDate}T23:59:59`);

// Fallback para contratos antigos sem contract_paid_at
const { data: contractsWithoutTimestamp } = await supabase
  .from('meeting_slot_attendees')
  .select(...)
  .eq('meeting_slot.closer_id', closerId)
  .in('status', ['contract_paid', 'refunded'])
  .is('contract_paid_at', null)
  .gte('meeting_slot.scheduled_at', `${startDate}...`)
  .lte('meeting_slot.scheduled_at', `${endDate}...`);

// Total de contratos = pagamentos no período + fallback
contratos_pagos = (contractsByPaymentDate?.length || 0) + 
                  (contractsWithoutTimestamp?.length || 0);
```

## Fluxo Corrigido

```text
ANTES (Problemático):
┌────────────────────────┐
│ Reunião em Janeiro     │
│ Pagamento em Fevereiro │
└────────────────────────┘
         │
         ▼
┌────────────────────────┐
│ Contagem em JANEIRO    │  <-- Errado (usa scheduled_at)
└────────────────────────┘

DEPOIS (Correto):
┌────────────────────────┐
│ Reunião em Janeiro     │
│ Pagamento em Fevereiro │
└────────────────────────┘
         │
         ▼
┌────────────────────────┐
│ Contagem em FEVEREIRO  │  <-- Correto (usa contract_paid_at)
└────────────────────────┘
```

## Impacto

- **Closers** terão contratos contabilizados corretamente na data da venda
- Follow-ups que fecham depois da reunião original serão creditados no mês correto
- Mantém fallback para contratos antigos sem timestamp de pagamento
- Alinha comportamento com `useR1CloserMetrics.ts` que já usa essa lógica

## Resumo Técnico

- **1 arquivo** modificado (`useCloserAgendaMetrics.ts`)
- **1 query adicional** para contratos por `contract_paid_at`
- **Zero breaking changes** - apenas corrige a data de atribuição
