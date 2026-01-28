
# Corrigir Atualização de Pendentes e No-Shows na Agenda R2

## Diagnóstico Completo

### Problema 1: Pendentes não atualiza após agendar

**Causa identificada no código:**

1. A invalidação usa query key `['r2-noshows']`, mas os hooks reais usam:
   - `['r2-noshow-leads', dateFilter, selectedDate, ...]` 
   - `['r2-noshow-count']`

2. Falta invalidar `['r2-noshow-count']` e `['r2-noshow-leads']` nos mutations.

### Problema 2: No-Shows continua contando após reagendar

**Causa identificada:**

Quando um no-show é reagendado para outro dia (Case 1 no código), o sistema:
- Cria um **novo** attendee vinculado via `parent_attendee_id`
- Atualiza apenas o `meeting_slot.status` para `rescheduled`
- **NÃO atualiza** o attendee original - ele continua com `status: 'no_show'`

**Evidência no código (linhas 167-171):**
```typescript
// 4. Mark original slot as rescheduled (keep original attendee as no_show for history)
await supabase
  .from('meeting_slots')
  .update({ status: 'rescheduled' })
  .eq('id', meetingId);
// ❌ O attendee original NÃO é atualizado!
```

**Resultado:** O `useR2NoShowsCount` continua contando esse attendee porque ele ainda tem `status: 'no_show'`.

---

## Solução

### 1. Corrigir Query Keys de Invalidação

**Arquivo:** `src/hooks/useR2AgendaData.ts`

Adicionar invalidações corretas em todos os mutations:

| Hook | Adicionar |
|------|-----------|
| `useUpdateR2MeetingStatus` | `['r2-noshow-count']`, `['r2-noshow-leads']` |
| `useRescheduleR2Meeting` | `['r2-noshow-count']`, `['r2-noshow-leads']` (substituir `['r2-noshows']`) |
| `useCreateR2Meeting` | `['r2-noshow-count']`, `['r2-noshow-leads']` |

### 2. Atualizar Status do Attendee Original ao Reagendar

**Arquivo:** `src/hooks/useR2AgendaData.ts`

No Case 1 (no-show reagendado para outro dia), após criar o novo attendee, atualizar o attendee original para `status: 'rescheduled'`:

```typescript
// Após linha 163, adicionar:
// 4.5 Update original attendee status to prevent double-counting
await supabase
  .from('meeting_slot_attendees')
  .update({ status: 'rescheduled' })
  .eq('id', attendeeId);
```

---

## Mudanças Detalhadas

### Arquivo: `src/hooks/useR2AgendaData.ts`

#### Mudança 1: `useUpdateR2MeetingStatus` (onSuccess - linhas 62-66)

Adicionar invalidação dos contadores de no-show:

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['r2-agenda-meetings'] });
  queryClient.invalidateQueries({ queryKey: ['r2-meetings-extended'] });
  queryClient.invalidateQueries({ queryKey: ['r2-noshow-count'] });
  queryClient.invalidateQueries({ queryKey: ['r2-noshow-leads'] });
  queryClient.invalidateQueries({ queryKey: ['r2-pending-leads'] });
  toast.success('Status atualizado');
},
```

#### Mudança 2: `useRescheduleR2Meeting` - Atualizar attendee original (após linha 163)

```typescript
// 4.5 Update original attendee status to 'rescheduled' to remove from no-show count
await supabase
  .from('meeting_slot_attendees')
  .update({ status: 'rescheduled' })
  .eq('id', attendeeId);
```

#### Mudança 3: `useRescheduleR2Meeting` (onSuccess - linhas 241-246)

Substituir query key incorreta e adicionar contadores:

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['r2-agenda-meetings'] });
  queryClient.invalidateQueries({ queryKey: ['r2-meetings-extended'] });
  queryClient.invalidateQueries({ queryKey: ['r2-noshow-count'] });
  queryClient.invalidateQueries({ queryKey: ['r2-noshow-leads'] });
  queryClient.invalidateQueries({ queryKey: ['r2-pending-leads'] });
  toast.success('Reunião R2 reagendada');
},
```

#### Mudança 4: `useCreateR2Meeting` (onSuccess - linhas 337-341)

Adicionar invalidação dos contadores de no-show:

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['r2-agenda-meetings'] });
  queryClient.invalidateQueries({ queryKey: ['r2-meetings-extended'] });
  queryClient.invalidateQueries({ queryKey: ['r2-pending-leads'] });
  queryClient.invalidateQueries({ queryKey: ['r2-noshow-count'] });
  queryClient.invalidateQueries({ queryKey: ['r2-noshow-leads'] });
  toast.success('Reunião R2 agendada com sucesso');
},
```

---

## Resultado Esperado

| Ação | Antes | Depois |
|------|-------|--------|
| Agendar R2 via modal | Pendentes não atualiza | Badge atualiza imediatamente |
| Reagendar no-show (outro dia) | Conta 2x (original + novo) | Original vira "rescheduled", sai do contador |
| Badge de No-Shows | Não diminui | Diminui ao reagendar |
| Badge de Pendentes | Não diminui | Diminui ao agendar R2 |

---

## Resumo Técnico

- **Query keys erradas:** `['r2-noshows']` não existe; hooks usam `['r2-noshow-count']` e `['r2-noshow-leads']`
- **Attendee original não atualizado:** No Case 1, o attendee original mantinha `status: 'no_show'`
- **Solução:** Corrigir invalidações + atualizar status do attendee original para `'rescheduled'`
- **Risco:** Baixo (apenas corrige lógica de cache e status)
