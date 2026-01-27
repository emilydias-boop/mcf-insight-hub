
# Plano: Ajustes no Drawer de Detalhes R2

## Resumo das Mudanças

| Item | Estado Atual | Mudança |
|------|--------------|---------|
| Botão "Reagendar" | Presente no drawer | Remover - usar aba de No-Shows para reagendar |
| "Cancelar Reunião" | Marca slot como `canceled` (fica riscado) | Remover todos os attendees e deletar/marcar slot vazio |
| "Realizada" | Apenas muda status | Exibir alerta para lembrar de dar Status Final |
| Reembolso | ✅ Já funciona corretamente | Nenhuma mudança necessária |

---

## 1. Remover Botão "Reagendar"

**Arquivo:** `src/components/crm/R2MeetingDetailDrawer.tsx`

**Justificativa:** O fluxo correto é:
1. Sócio marca como "No-show"
2. Lead aparece automaticamente na aba "No-Shows"
3. Yanca (coordenadora) reagenda a partir dessa aba

**Mudança:** Remover o botão "Reagendar" do grid de ações no footer (linhas 360-366).

**Antes:**
```tsx
<div className="grid grid-cols-2 gap-2">
  <Button variant="outline" onClick={() => onReschedule(meeting)}>
    <Clock className="h-4 w-4 mr-2" />
    Reagendar
  </Button>
  <Button variant="outline" className="text-orange-600..." onClick={() => setRefundModalOpen(true)}>
    <RotateCcw className="h-4 w-4 mr-2" />
    Reembolso
  </Button>
</div>
```

**Depois:**
```tsx
<Button 
  variant="outline"
  className="w-full text-orange-600 border-orange-200 hover:bg-orange-50"
  onClick={() => setRefundModalOpen(true)}
>
  <RotateCcw className="h-4 w-4 mr-2" />
  Reembolso
</Button>
```

---

## 2. Corrigir "Cancelar Reunião"

**Problema atual:** O hook `useCancelR2Meeting` apenas marca `meeting_slots.status = 'canceled'`, deixando o horário riscado na agenda. Isso polui a visualização quando novos leads são agendados no mesmo horário.

**Solução:** Ao cancelar a reunião R2:
1. Remover todos os attendees do slot
2. Deletar o slot (se vazio) OU marcar como cancelado apenas se precisar manter histórico

**Arquivo:** `src/hooks/useR2AttendeeUpdate.ts`

**Mudança:** Modificar `useCancelR2Meeting` para:

```typescript
export function useCancelR2Meeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (meetingId: string) => {
      // 1. Deletar todos os attendees deste slot
      const { error: deleteAttendeesError } = await supabase
        .from('meeting_slot_attendees')
        .delete()
        .eq('meeting_slot_id', meetingId);

      if (deleteAttendeesError) throw deleteAttendeesError;

      // 2. Deletar o slot de reunião (em vez de apenas marcar como canceled)
      const { error: deleteSlotError } = await supabase
        .from('meeting_slots')
        .delete()
        .eq('id', meetingId);

      if (deleteSlotError) throw deleteSlotError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['r2-meetings-extended'] });
      toast.success('Reunião cancelada e removida');
    },
    onError: () => {
      toast.error('Erro ao cancelar reunião');
    }
  });
}
```

**Nota:** Ao deletar completamente, o slot não aparecerá mais como "riscado", permitindo que novos leads ocupem esse horário normalmente.

---

## 3. Lembrar de Dar Status ao Marcar "Realizada"

**Problema:** Quando o sócio marca a reunião como "Realizada", ele pode esquecer de preencher o "Status Final" na aba de Avaliação R2.

**Solução:** Exibir um `toast.info` ou dialog após marcar como realizada, lembrando de preencher o status.

**Arquivo:** `src/components/crm/R2MeetingDetailDrawer.tsx`

**Mudança:** Modificar `handleParticipantStatusChange` para exibir lembrete quando status = 'completed':

```typescript
const handleParticipantStatusChange = (newStatus: string) => {
  if (!attendee) return;
  
  const statusesToSyncSlot = ['completed', 'contract_paid'];
  const isPrincipal = !attendee.partner_name;
  const shouldSyncSlot = statusesToSyncSlot.includes(newStatus) && isPrincipal;

  updateAttendeeAndSlotStatus.mutate({
    attendeeId: attendee.id,
    status: newStatus,
    meetingId: meeting.id,
    syncSlot: shouldSyncSlot,
    meetingType: 'r2',
  }, {
    onSuccess: () => {
      // Lembrar de dar status quando marcar como realizada
      if (newStatus === 'completed') {
        toast.info(
          'Lembre-se de preencher o Status Final na aba "Avaliação R2"',
          { duration: 5000 }
        );
      }
    }
  });
};
```

---

## 4. Reembolso - Verificação

**Resultado:** O Reembolso já está funcionando corretamente!

O `RefundModal` já faz:
1. ✅ Atualiza `meeting_slots.status` para `'refunded'`
2. ✅ Atualiza `crm_deals.custom_fields` com:
   - `reembolso_solicitado: true`
   - `reembolso_em: timestamp`
   - `motivo_reembolso: "..."` 
   - `justificativa_reembolso: "..."`
   - `motivo_sem_interesse: "Reembolso"`
3. ✅ Move o deal para uma stage de "Perdido"
4. ✅ Registra atividade `loss_marked` com os detalhes

**Não é necessária nenhuma mudança.**

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/crm/R2MeetingDetailDrawer.tsx` | Remover botão "Reagendar", adicionar toast de lembrete ao marcar "Realizada" |
| `src/hooks/useR2AttendeeUpdate.ts` | Modificar `useCancelR2Meeting` para deletar attendees e slot |

---

## Impacto

1. **Reagendar:** Fluxo fica mais organizado - apenas Yanca reagenda via aba No-Shows
2. **Cancelar:** Horários cancelados não ficam mais "riscados" poluindo a agenda
3. **Realizada:** Sócios serão lembrados de preencher Status Final
4. **Reembolso:** Já funciona - lead fica sinalizado no CRM

