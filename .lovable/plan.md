
# Plano: Adicionar Opcao para Admin Restaurar Status de Attendee

## Problema

O lead "Francisco Antonio da Silva Rocha" foi movido antes do fix de preservacao de status. Consequentemente:
- `status` no banco = `rescheduled` (incorreto)
- Deveria ser = `contract_paid` (status original)

O fix que implementamos so funciona para movimentos **futuros**.

---

## Solucao

Adicionar um botao para admins restaurarem o status `contract_paid` de um attendee que foi incorretamente alterado durante um movimento.

---

## Alteracoes

### 1. Arquivo: `src/hooks/useAgendaData.ts`

Adicionar mutation `useRestoreAttendeeContractPaid`:

```typescript
export function useRestoreAttendeeContractPaid() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ attendeeId }: { attendeeId: string }) => {
      const { error } = await supabase
        .from('meeting_slot_attendees')
        .update({ 
          status: 'contract_paid',
          is_reschedule: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', attendeeId);
      
      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['meeting-slot'] });
      toast.success('Status restaurado para Contrato Pago');
    },
  });
}
```

### 2. Arquivo: `src/components/crm/AgendaMeetingDrawer.tsx`

**Parte A**: Importar o hook e adicionar estado

```typescript
import { useRestoreAttendeeContractPaid } from '@/hooks/useAgendaData';

// Dentro do componente
const restoreContractPaid = useRestoreAttendeeContractPaid();
```

**Parte B**: Adicionar botao na area de acoes do participante (linha 706-748)

Para participantes com status `rescheduled` mas que tem `parent_attendee_id` (foram movidos), adicionar opcao de restaurar:

```typescript
{/* Botao Restaurar Contrato Pago - apenas para admins quando status esta incorreto */}
{canTransfer && p.id && p.parentAttendeeId && p.status === 'rescheduled' && (
  <Button
    variant="ghost"
    size="icon"
    className="h-8 w-8"
    onClick={(e) => {
      e.stopPropagation();
      restoreContractPaid.mutate({ attendeeId: p.id! });
    }}
    title="Restaurar para Contrato Pago"
    disabled={restoreContractPaid.isPending}
  >
    <DollarSign className="h-4 w-4 text-green-600" />
  </Button>
)}
```

---

## Interface Visual

O botao aparecera apenas quando:
- Usuario e admin/manager/coordenador (`canTransfer`)
- Participante foi movido (`parentAttendeeId` existe)
- Status atual e `rescheduled`

Ao clicar:
- Status atualiza para `contract_paid`
- `is_reschedule` atualiza para `false`
- Badges "Remanejado" e "Reagendada" desaparecem
- Badge "Contrato Pago" aparece

---

## Resumo

| Arquivo | Alteracao |
|---------|-----------|
| `useAgendaData.ts` | Nova mutation `useRestoreAttendeeContractPaid` |
| `AgendaMeetingDrawer.tsx` | Botao para restaurar status de attendees movidos |

---

## Resultado

O admin podera clicar no botao $ verde para restaurar o status de "Francisco Antonio da Silva Rocha" para "Contrato Pago", corrigindo o erro do movimento anterior ao fix.
