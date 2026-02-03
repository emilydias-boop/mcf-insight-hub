
# Plano: Preservar Status ao Mover Lead para Admin

## Problema

Ao mover um lead, o sistema sempre define `status: 'rescheduled'`, perdendo o status original como **contract_paid**, **completed**, etc.

---

## Solução

Adicionar lógica para admin que preserve o status original do attendee ao mover.

---

## Alterações

### Arquivo: `src/components/crm/MoveAttendeeModal.tsx`

**Localização: Linhas 308-316 (moveToNewSlot mutationFn)**

**De:**
```typescript
const { error: moveError } = await supabase
  .from('meeting_slot_attendees')
  .update({ 
    meeting_slot_id: targetSlotId,
    status: 'rescheduled',
    is_reschedule: true,
    updated_at: new Date().toISOString()
  })
  .eq('id', attendee.id);
```

**Para:**
```typescript
// Admin preserva status original (contract_paid, completed, etc)
// Usuários normais sempre marcam como rescheduled
const shouldPreserveStatus = isAdmin && 
  ['contract_paid', 'completed', 'refunded', 'approved', 'rejected'].includes(currentAttendeeStatus || '');

const { error: moveError } = await supabase
  .from('meeting_slot_attendees')
  .update({ 
    meeting_slot_id: targetSlotId,
    status: shouldPreserveStatus ? currentAttendeeStatus : 'rescheduled',
    is_reschedule: !shouldPreserveStatus, // Só marca como reschedule se não preservou
    updated_at: new Date().toISOString()
  })
  .eq('id', attendee.id);
```

**Também atualizar o log de movimentação (linha 379):**

Adicionar campo para indicar que status foi preservado no movimento:

```typescript
await supabase.from('attendee_movement_logs').insert({
  // ... campos existentes
  movement_type: shouldPreserveStatus ? 'transfer_preserved' : 'move',
  // ...
});
```

---

## Comportamento Resultante

| Usuário | Status Original | Status Após Mover |
|---------|----------------|-------------------|
| Normal | contract_paid | rescheduled |
| Normal | scheduled | rescheduled |
| Admin | contract_paid | **contract_paid** (preservado) |
| Admin | completed | **completed** (preservado) |
| Admin | scheduled | rescheduled |

---

## Resumo

- **Usuários normais**: Comportamento atual mantido (sempre rescheduled)
- **Admin**: Preserva status importantes (contract_paid, completed, refunded, approved, rejected)
- **Auditoria**: Log registra tipo de movimento diferente para tracking
