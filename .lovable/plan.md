

# Corrigir: Excluir Leads Outside da Métrica "Contrato Pago"

## Problema
Leads que compraram contrato **antes** da R1 (Outside) estão sendo contados como "Contrato Pago" para os Closers, inflando incorretamente suas métricas de conversão.

## Arquivos a Modificar

### 1. `src/hooks/useR1CloserMetrics.ts`
Usado no Painel Comercial (tabela de Closers R1)

### 2. `src/hooks/useCloserAgendaMetrics.ts`
Usado no sistema de Fechamento

## Solução Técnica

### Lógica de Detecção de Outside
Para cada contrato pago, comparar:
- `contract_paid_at` (ou `sale_date` da Hubla) com `scheduled_at` da reunião
- Se `contract_paid_at < scheduled_at` → É Outside → NÃO contar como Contrato Pago

### Alteração em useR1CloserMetrics.ts

Na seção de contagem de contratos (linhas 168-239), adicionar a data da reunião na query e filtrar:

```tsx
// Query atual busca contract_paid_at e meeting_slot.scheduled_at
// Adicionar lógica para excluir Outside:

contractsByPaymentDate?.forEach(att => {
  const closerId = (att.meeting_slot as any)?.closer_id;
  const scheduledAt = (att.meeting_slot as any)?.scheduled_at;
  const contractPaidAt = att.contract_paid_at;
  
  // NOVO: Verificar se é Outside
  if (contractPaidAt && scheduledAt) {
    const isOutside = new Date(contractPaidAt) < new Date(scheduledAt);
    if (isOutside) {
      return; // Não contar Outside como contrato pago
    }
  }
  
  // ... resto da lógica existente
});
```

### Alteração em useCloserAgendaMetrics.ts

Adicionar `scheduled_at` na query de contratos e filtrar:

```tsx
// Query 1: Adicionar scheduled_at para verificação
const { data: contractsByPaymentDate } = await supabase
  .from('meeting_slot_attendees')
  .select(`
    id, status, contract_paid_at,
    meeting_slot:meeting_slots!inner(closer_id, scheduled_at)  // ← Adicionar scheduled_at
  `)
  // ... resto dos filtros

// Ao contar, excluir Outside:
let contratos_pagos = 0;

contractsByPaymentDate?.forEach(att => {
  const scheduledAt = (att.meeting_slot as any)?.scheduled_at;
  const contractPaidAt = att.contract_paid_at;
  
  // Excluir Outside
  if (contractPaidAt && scheduledAt && new Date(contractPaidAt) < new Date(scheduledAt)) {
    return; // Outside - não contar
  }
  
  contratos_pagos++;
});
```

## Resultado Esperado

| Cenário | Data Pagamento | Data R1 | Conta como Outside? | Conta como Contrato Pago? |
|---------|----------------|---------|---------------------|--------------------------|
| Normal | 05/02 18:00 | 05/02 14:00 | Não | **Sim** |
| Outside | 04/02 10:00 | 05/02 14:00 | Sim | **Não** |

## Impacto
- Taxa de conversão dos Closers será calculada corretamente
- Leads Outside continuam visíveis na coluna "Outside" (apenas para informação)
- Não afeta outras métricas (R1 Agendada, R1 Realizada, No-show, etc.)

