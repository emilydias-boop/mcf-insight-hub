
# Plano: Completar Preservacao de Status em Todos os Fluxos de Movimento

## Problema

A preservacao de status para admin foi implementada apenas no fluxo de "mesmo dia". Dois outros fluxos ainda forcam `status: 'rescheduled'`:

1. **Encaixar em Reuniao Existente** (`useMoveAttendeeToMeeting` em useAgendaData.ts)
2. **Mover para novo slot em dia diferente** (criacao de novo attendee em MoveAttendeeModal.tsx)

---

## Solucao

Adicionar parametro `isAdmin` e logica de preservacao nos dois locais faltantes.

---

## Alteracoes

### 1. Arquivo: `src/hooks/useAgendaData.ts`

**Modificar `useMoveAttendeeToMeeting` (linhas 1713-1791)**

Adicionar parametro `preserveStatus` na interface:

```typescript
export function useMoveAttendeeToMeeting() {
  // ...
  return useMutation({
    mutationFn: async ({ 
      // ... parametros existentes
      preserveStatus  // NOVO: boolean para admin
    }: { 
      // ... tipos existentes
      preserveStatus?: boolean;
    }) => {
      // Admin preserva status original (contract_paid, completed, etc)
      const shouldPreserve = preserveStatus && 
        ['contract_paid', 'completed', 'refunded', 'approved', 'rejected'].includes(currentAttendeeStatus || '');

      const { error: mainError } = await supabase
        .from('meeting_slot_attendees')
        .update({ 
          meeting_slot_id: targetMeetingSlotId,
          status: shouldPreserve ? currentAttendeeStatus : 'rescheduled',
          is_reschedule: !shouldPreserve,
          updated_at: new Date().toISOString()
        })
        .eq('id', attendeeId);

      // ... resto do codigo
      
      // Atualizar movement_type no log
      movement_type: shouldPreserve 
        ? 'transfer_preserved' 
        : (isNoShow ? 'no_show_reschedule' : 'same_day_reschedule'),
    }
  });
}
```

### 2. Arquivo: `src/components/crm/MoveAttendeeModal.tsx`

**Parte A: Passar `preserveStatus` na chamada de `handleMoveToExisting` (linha 404)**

```typescript
moveAttendee.mutate(
  { 
    // ... parametros existentes
    preserveStatus: isAdmin  // NOVO: passa flag de admin
  },
  // ...
);
```

**Parte B: Preservar status na criacao de novo attendee para dia diferente (linhas 211-225)**

```typescript
// Admin preserva status original ao mover para dia diferente
const shouldPreserveStatus = isAdmin && 
  ['contract_paid', 'completed', 'refunded', 'approved', 'rejected'].includes(currentAttendeeStatus || '');

const { data: newAttendee, error: createAttendeeError } = await supabase
  .from('meeting_slot_attendees')
  .insert({
    meeting_slot_id: targetSlotId,
    contact_id: originalAttendee.contact_id,
    deal_id: originalAttendee.deal_id,
    status: shouldPreserveStatus ? currentAttendeeStatus : 'rescheduled',
    is_reschedule: !shouldPreserveStatus,
    parent_attendee_id: attendee.id,
    booked_by: originalAttendee.booked_by,
    booked_at: new Date().toISOString(),
  })
  .select()
  .single();
```

**Parte C: Atualizar movement_type no log (linha 263)**

```typescript
movement_type: shouldPreserveStatus ? 'transfer_preserved' : 'no_show_reschedule',
```

**Parte D: Condicionar sync de deal stage (linhas 277-301)**

Apenas sincronizar deal stage para 'rescheduled' se NAO preservou status:

```typescript
if (originalAttendee.deal_id && !shouldPreserveStatus) {
  await syncDealStageFromAgenda(originalAttendee.deal_id, 'rescheduled', 'r1');
  // ... resto do codigo de reschedule count
}
```

---

## Fluxo de Movimento Completo Apos Correcao

| Fluxo | Usuario Normal | Admin |
|-------|----------------|-------|
| Novo slot (mesmo dia) | rescheduled | **Preserva** |
| Novo slot (dia diferente) | rescheduled | **Preserva** |
| Encaixar em reuniao existente | rescheduled | **Preserva** |

---

## Resumo das Alteracoes

| Arquivo | Local | Alteracao |
|---------|-------|-----------|
| `useAgendaData.ts` | `useMoveAttendeeToMeeting` | Adicionar `preserveStatus` param + logica |
| `MoveAttendeeModal.tsx` | `handleMoveToExisting` | Passar `preserveStatus: isAdmin` |
| `MoveAttendeeModal.tsx` | Criacao novo attendee | Adicionar `shouldPreserveStatus` |
| `MoveAttendeeModal.tsx` | Log movimento | Usar `transfer_preserved` quando preserva |
| `MoveAttendeeModal.tsx` | Sync deal stage | Condicionar ao NAO preservar |

---

## Resultado Esperado

Apos implementacao, ao mover o lead "Francisco Antonio da Silva Rocha" como admin:
- Status **contract_paid** sera mantido
- Badge mostrara "Contrato Pago" ao inves de "Remanejado"
- Deal permanece no estagio correto do CRM
