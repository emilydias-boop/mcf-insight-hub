

# Leads Outside: Exigir R1 Realizada Antes de R2

## Problema Atual
Quando um lead compra o contrato **antes** da R1 (Outside), ele aparece imediatamente na lista de "R2 Pendentes", permitindo agendar R2 mesmo sem a R1 ter sido realizada.

## Regra de Negócio Desejada
- **Lead Normal**: Contrato pago **depois** da R1 → aparece em R2 Pendentes imediatamente
- **Lead Outside**: Contrato pago **antes** da R1 → só aparece em R2 Pendentes **após** a R1 ser marcada como "Realizada" (completed)

## Solução Técnica

### Arquivo a Modificar
**`src/hooks/useR2PendingLeads.ts`**

### Alterações

#### 1. Adicionar Campo `status` do meeting_slot na Query
Incluir o status do slot para verificar se a R1 foi realizada:

```tsx
meeting_slot:meeting_slots!inner(
  id,
  scheduled_at,
  closer_id,
  meeting_type,
  status,  // ← ADICIONAR
  closer:closers(id, name)
)
```

#### 2. Atualizar Interface R2PendingLead
Adicionar campo `slot_status` para tipagem:

```tsx
meeting_slot: {
  id: string;
  scheduled_at: string;
  closer_id: string | null;
  status?: string;  // ← ADICIONAR
  closer?: { ... } | null;
};
```

#### 3. Adicionar Lógica de Filtro para Leads Outside
Após extrair os dados, verificar se o lead é Outside e se a R1 foi realizada:

```tsx
// Detectar se é Outside: contrato_paid_at < scheduled_at
const isOutside = (contractPaidAt: string, scheduledAt: string) => {
  return new Date(contractPaidAt) < new Date(scheduledAt);
};

// No filtro de pendingLeads, adicionar verificação:
const pendingLeads = attendeesWithContact
  .filter(a => {
    // ... filtros existentes de R2 já agendada ...
    
    // NOVO: Se for Outside, exigir R1 realizada
    const contractPaidAt = a.contract_paid_at || a.created_at;
    const scheduledAt = a.meeting_slot?.scheduled_at;
    
    if (contractPaidAt && scheduledAt) {
      const leadIsOutside = new Date(contractPaidAt) < new Date(scheduledAt);
      if (leadIsOutside) {
        // Outside: só incluir se R1 foi realizada (completed)
        const slotStatus = a.meeting_slot?.status;
        if (slotStatus !== 'completed') {
          return false;  // Excluir: Outside sem R1 realizada
        }
      }
    }
    
    return true;
  })
```

## Fluxo Visual

```text
┌─────────────────────────────────────────────────────────────────┐
│                     LEAD COMPRA CONTRATO                        │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
     ┌────────────────┐              ┌────────────────┐
     │ DEPOIS da R1   │              │ ANTES da R1    │
     │ (Normal)       │              │ (Outside)      │
     └────────────────┘              └────────────────┘
              │                               │
              ▼                               ▼
     ┌────────────────┐              ┌────────────────┐
     │ Vai direto     │              │ Aguarda R1     │
     │ para R2        │              │ ser Realizada  │
     │ Pendentes      │              │                │
     └────────────────┘              └────────────────┘
                                              │
                                              ▼
                                     ┌────────────────┐
                                     │ Closer marca   │
                                     │ R1 Realizada   │
                                     └────────────────┘
                                              │
                                              ▼
                                     ┌────────────────┐
                                     │ Aparece em R2  │
                                     │ Pendentes      │
                                     └────────────────┘
```

## Comportamento Esperado

| Cenário | Data Contrato | Data R1 | Status R1 | Aparece em R2 Pendentes? |
|---------|--------------|---------|-----------|-------------------------|
| Normal | 05/02 18:00 | 05/02 14:00 | completed | Sim |
| Normal | 05/02 18:00 | 05/02 14:00 | scheduled | Sim |
| Outside | 04/02 10:00 | 05/02 14:00 | completed | Sim |
| Outside | 04/02 10:00 | 05/02 14:00 | scheduled | **Não** |
| Outside | 04/02 10:00 | 05/02 14:00 | rescheduled | **Não** |

## Impacto
- Leads Outside só vão para R2 quando o Closer marcar a R1 como realizada
- Leads normais continuam funcionando como antes
- Não afeta outras partes do sistema (métricas, relatórios, etc.)

