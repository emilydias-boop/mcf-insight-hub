
# Plano: Adicionar Exclusão de Participante Único e Cancelamento de Reunião

## Problema Identificado

Quando uma reunião R2 tem apenas **1 participante**, não existe forma de:
1. Excluir esse participante
2. Cancelar a reunião inteira

O botão de lixeira só aparece quando há mais de 1 participante (linha 179: `meeting.attendees.length > 1`).

## Solução Proposta

### Comportamento Desejado

| Situação | Ação "Excluir Participante" | Resultado |
|----------|----------------------------|-----------|
| Múltiplos participantes | Remove só o selecionado | Reunião continua com os demais |
| **Participante único** | Remove o participante | Reunião é **cancelada** automaticamente |

Adicionar também um botão "Cancelar Reunião" que cancela tudo de uma vez (slot + todos participantes).

## Mudanças Necessárias

### 1. Criar Hook para Cancelar Reunião R2

**Arquivo:** `src/hooks/useR2AttendeeUpdate.ts`

Adicionar novo hook `useCancelR2Meeting` que:
- Atualiza status do `meeting_slot` para "canceled"
- Invalida os caches corretos do R2

### 2. Criar Hook para Remover Último Participante

**Arquivo:** `src/hooks/useR2AttendeeUpdate.ts`

Modificar ou criar `useRemoveR2AttendeeAndCancelIfEmpty` que:
- Remove o participante
- Se era o último, cancela o meeting_slot automaticamente

### 3. Atualizar R2MeetingDetailDrawer

**Arquivo:** `src/components/crm/R2MeetingDetailDrawer.tsx`

**Mudanças:**

1. **Remover condição** `meeting.attendees.length > 1` (linha 179)
   - Mostrar botão de lixeira sempre

2. **Alterar lógica do handleRemoveAttendee**:
   - Se há mais de 1 participante: apenas remove
   - Se é o último: confirma e cancela a reunião também

3. **Adicionar botão "Cancelar Reunião"** no footer:
   - Permite cancelar toda a reunião de uma vez
   - Útil quando quer desmarcar sem excluir o lead do histórico

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────┐
│                    R2MeetingDetailDrawer                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Participantes (1)                                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 🔴 Odesmar Martins da Silva    [Selecionado] [🗑️]    │  │
│  └───────────────────────────────────────────────────────┘  │
│       ↓                                                     │
│  Clicou no 🗑️ do único participante?                       │
│       ↓                                                     │
│  Confirmar: "Ao remover o único participante, a reunião     │
│             será cancelada. Deseja continuar?"              │
│       ↓                                                     │
│  1. DELETE meeting_slot_attendees                           │
│  2. UPDATE meeting_slots SET status = 'canceled'            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  FOOTER (atual + novo botão):                               │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │ ✓ Realizada  │  │ ✗ No-show    │                         │
│  └──────────────┘  └──────────────┘                         │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │ 🕐 Reagendar │  │ ↩ Reembolso  │                         │
│  └──────────────┘  └──────────────┘                         │
│  ┌─────────────────────────────────┐  ← NOVO                │
│  │ 🗑️ Cancelar Reunião            │                         │
│  └─────────────────────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useR2AttendeeUpdate.ts` | Adicionar `useCancelR2Meeting` |
| `src/components/crm/R2MeetingDetailDrawer.tsx` | Remover condição, adicionar botão cancelar |

## Detalhes Técnicos

### Novo Hook: useCancelR2Meeting

```typescript
export function useCancelR2Meeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (meetingId: string) => {
      const { error } = await supabase
        .from('meeting_slots')
        .update({ status: 'canceled' })
        .eq('id', meetingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['r2-meetings-extended'] });
      toast.success('Reunião cancelada');
    },
  });
}
```

### Lógica Atualizada do handleRemoveAttendee

```typescript
const handleRemoveAttendee = (attendeeId: string) => {
  const isLastAttendee = meeting.attendees?.length === 1;
  
  const confirmMessage = isLastAttendee
    ? 'Ao remover o único participante, a reunião será cancelada. Deseja continuar?'
    : 'Deseja remover este participante da reunião?';
  
  if (confirm(confirmMessage)) {
    removeAttendee.mutate(attendeeId, {
      onSuccess: () => {
        if (isLastAttendee) {
          cancelMeeting.mutate(meeting.id);
          onOpenChange(false); // Fecha o drawer
        } else {
          const remaining = meeting.attendees?.filter(a => a.id !== attendeeId);
          if (remaining?.length) {
            setSelectedAttendeeId(remaining[0].id);
          }
        }
      }
    });
  }
};
```

### Botão Cancelar Reunião

```typescript
<Button 
  variant="outline"
  className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
  onClick={() => {
    if (confirm('Deseja cancelar esta reunião? Todos os participantes serão afetados.')) {
      cancelMeeting.mutate(meeting.id);
      onOpenChange(false);
    }
  }}
>
  <Trash2 className="h-4 w-4 mr-2" />
  Cancelar Reunião
</Button>
```

## Fluxo de Implementação

```text
1. Adicionar useCancelR2Meeting no hook
          ↓
2. Remover condição length > 1 do botão lixeira
          ↓
3. Atualizar lógica handleRemoveAttendee
          ↓
4. Adicionar botão "Cancelar Reunião" no footer
          ↓
5. Testar cenários: único participante e múltiplos
```

## Benefícios

1. **Flexibilidade**: Pode remover participante único sem travar
2. **Consistência**: Reunião sem participantes é automaticamente cancelada
3. **Clareza**: Mensagem de confirmação diferente para cada cenário
4. **Ação Rápida**: Botão para cancelar reunião inteira de uma vez
