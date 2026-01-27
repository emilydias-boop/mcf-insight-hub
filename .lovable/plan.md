
# Plano: Corrigir Exibição de Reuniões Canceladas e Adicionar Botão de Desfazer

## Diagnóstico Completo

### Problema 1: Por que a reunião das 19:00h aparece riscada

A reunião às 22:00 UTC (19:00 BRT) da Claudia Carielo possui **3 slots de reunião diferentes**:

| Slot | Status | Participantes |
|------|--------|---------------|
| `106eb01a-...` | ❌ **canceled** | 0 (vazio) |
| `47ac9546-...` | ✅ scheduled | Ana Luzia |
| `4e58f7fc-...` | ✅ scheduled | Victor Hugo |

O código de consolidação em `R2CloserColumnCalendar.tsx` (linha 68-78) usa o status do **primeiro** slot encontrado:

```typescript
return {
  ...slotMeetings[0],  // ← Herda status do primeiro slot (canceled)
  attendees: slotMeetings.flatMap(m => m.attendees || [])
};
```

Como o slot cancelado é o primeiro no array, a visualização inteira fica com `line-through`, mesmo tendo participantes ativos.

### Problema 2: Logs de auditoria

- O slot foi cancelado em **26/01/2026 às 22:13 UTC**
- **Não há trigger de auditoria** para a tabela `meeting_slots` — apenas `meeting_slot_attendees` é monitorada
- Por isso, não é possível identificar quem cancelou

---

## Solução em 3 Partes

### Parte 1: Corrigir a consolidação de slots (prioridade imediata)

**Arquivo:** `src/components/crm/R2CloserColumnCalendar.tsx`

**Mudança:** Modificar `getConsolidatedMeetingForSlot()` para:
1. Filtrar slots cancelados que estão vazios (sem attendees)
2. Priorizar o status de slots não-cancelados
3. Unificar attendees de todos os slots válidos

```typescript
const getConsolidatedMeetingForSlot = (...): R2Meeting | undefined => {
  const slotMeetings = getMeetingsForSlot(closerId, hour, minute);
  if (slotMeetings.length === 0) return undefined;
  
  // Filter out canceled slots with no attendees
  const validMeetings = slotMeetings.filter(m => 
    m.status !== 'canceled' || (m.attendees && m.attendees.length > 0)
  );
  
  if (validMeetings.length === 0) {
    // All are empty canceled slots - show the canceled state
    return slotMeetings[0];
  }
  
  // Prioritize non-canceled meeting for status
  const primaryMeeting = validMeetings.find(m => m.status !== 'canceled') 
    || validMeetings[0];
  
  // Consolidate all attendees
  return {
    ...primaryMeeting,
    attendees: validMeetings.flatMap(m => m.attendees || [])
  };
};
```

### Parte 2: Adicionar botão "Desfazer Cancelamento"

**Arquivos:**
- `src/hooks/useR2AttendeeUpdate.ts` — adicionar hook `useRestoreR2Meeting`
- `src/components/crm/R2MeetingDetailDrawer.tsx` — adicionar botão condicional no footer

**Lógica:**
- Exibir botão **apenas** quando `meeting.status === 'canceled'`
- Ao clicar, atualizar o slot para `status: 'scheduled'`
- Invalidar caches relevantes

```typescript
// useR2AttendeeUpdate.ts - novo hook
export function useRestoreR2Meeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (meetingId: string) => {
      const { error } = await supabase
        .from('meeting_slots')
        .update({ status: 'scheduled' })
        .eq('id', meetingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['r2-meetings-extended'] });
      toast.success('Reunião restaurada');
    },
    onError: () => {
      toast.error('Erro ao restaurar reunião');
    }
  });
}
```

**UI no drawer:**
```tsx
{meeting.status === 'canceled' && (
  <Button 
    variant="outline"
    className="w-full text-primary border-primary/30 hover:bg-primary/10"
    onClick={() => restoreMeeting.mutate(meeting.id)}
  >
    <RotateCcw className="h-4 w-4 mr-2" />
    Desfazer Cancelamento
  </Button>
)}
```

### Parte 3: Adicionar auditoria para `meeting_slots` (recomendado)

**Arquivo:** Nova migração SQL

Para rastrear futuras alterações de status em reuniões:

```sql
-- Criar trigger de auditoria para meeting_slots
CREATE TRIGGER audit_meeting_slots_trigger
  AFTER INSERT OR UPDATE OR DELETE ON meeting_slots
  FOR EACH ROW EXECUTE FUNCTION log_audit_changes();
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/crm/R2CloserColumnCalendar.tsx` | Corrigir `getConsolidatedMeetingForSlot()` para ignorar slots cancelados vazios |
| `src/hooks/useR2AttendeeUpdate.ts` | Adicionar hook `useRestoreR2Meeting` |
| `src/components/crm/R2MeetingDetailDrawer.tsx` | Adicionar botão "Desfazer Cancelamento" condicional |

---

## Correção Imediata de Dados

Para resolver o problema atual das 19:00h, posso também oferecer um SQL para limpar slots cancelados vazios:

```sql
-- Deletar slots cancelados que não têm participantes
DELETE FROM meeting_slots ms
WHERE ms.status = 'canceled'
  AND NOT EXISTS (
    SELECT 1 FROM meeting_slot_attendees msa 
    WHERE msa.meeting_slot_id = ms.id
  );
```

---

## Resultado Esperado

1. **Imediato:** Reunião das 19:00h de Victor Hugo e Ana Luzia aparecerá corretamente (sem `line-through`)
2. **UX:** Usuários poderão restaurar reuniões canceladas por engano
3. **Auditoria:** Futuras mudanças de status em `meeting_slots` serão rastreáveis
