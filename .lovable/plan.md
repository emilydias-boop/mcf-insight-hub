
# Plano: Mostrar Todas as Reuniões do Closer para Admin

## Problema Identificado

A query `useMeetingsForDate` (linha 1833 em useAgendaData.ts) filtra apenas reuniões com status `scheduled` ou `rescheduled`:

```typescript
.in('status', ['scheduled', 'rescheduled'])
```

Isso exclui reuniões com status `completed`, que são a maioria das reuniões da Cristiane Gomes no dia.

---

## Solução

Para permitir que o admin veja e encaixe em QUALQUER reunião do closer, preciso:

### 1. Modificar `useMeetingsForDate` para aceitar parâmetro de bypass

**Arquivo:** `src/hooks/useAgendaData.ts`

```typescript
export function useMeetingsForDate(date: Date | null, includeCompleted: boolean = false) {
  return useQuery({
    queryKey: ['meetings-for-date', date?.toISOString(), includeCompleted],
    queryFn: async () => {
      // ...
      let query = supabase
        .from('meeting_slots')
        .select(...)
        .gte('scheduled_at', startOfDay.toISOString())
        .lte('scheduled_at', endOfDay.toISOString());
      
      // Admin pode ver todas, incluindo completed
      if (includeCompleted) {
        query = query.in('status', ['scheduled', 'rescheduled', 'completed']);
      } else {
        query = query.in('status', ['scheduled', 'rescheduled']);
      }
      // ...
    },
  });
}
```

### 2. Passar isAdmin para o hook no MoveAttendeeModal

**Arquivo:** `src/components/crm/MoveAttendeeModal.tsx`

```typescript
const { data: meetings, isLoading: meetingsLoading } = useMeetingsForDate(
  selectedDate,
  isAdmin // Admin vê reuniões completed também
);
```

### 3. Adicionar indicador visual de status na lista de reuniões

Na seção "Encaixar em Reunião Existente", mostrar badge indicando se a reunião está completed:

```typescript
<Badge 
  variant={meeting.status === 'completed' ? 'secondary' : 'outline'}
  className={cn(
    'text-xs',
    meeting.status === 'completed' && 'text-blue-600 border-blue-300'
  )}
>
  {meeting.status === 'completed' ? 'Realizada' : 'Agendada'}
</Badge>
```

---

## Fluxo Visual Resultante

**Usuário Normal:**
```text
Encaixar em Reunião Existente:
  Cristiane Gomes - 12:15 [Agendada] - 1 participante [Encaixar]
```

**Admin:**
```text
Encaixar em Reunião Existente:
  Cristiane Gomes - 12:15 [Agendada] - 1 participante [Encaixar]
  Cristiane Gomes - 13:15 [Realizada] - 2 participantes [Encaixar]
  Cristiane Gomes - 14:30 [Realizada] - 1 participante [Encaixar]
  Cristiane Gomes - 17:00 [Realizada] - 3 participantes [Encaixar]
  Cristiane Gomes - 19:00 [Realizada] - 2 participantes [Encaixar]
  ... (todas as 7 reuniões)
```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useAgendaData.ts` | Adicionar parâmetro `includeCompleted` em `useMeetingsForDate` |
| `src/components/crm/MoveAttendeeModal.tsx` | Passar `isAdmin` para o hook + badge de status |

---

## Considerações

1. **Apenas Admin**: Somente admins veem reuniões com status `completed`
2. **Auditoria**: O log de movimentação já registra todas as ações
3. **Sem alteração de banco**: Apenas lógica de frontend/query
