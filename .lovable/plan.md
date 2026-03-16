

## Diagnóstico: Sócio herdando SDR errado

### Problema encontrado
No arquivo `src/hooks/useAgendaData.ts`, na função `useAddMeetingAttendee` (linha 1154-1177), quando um sócio é adicionado a uma reunião, o código **herda o `booked_by` do participante principal** (parent attendee):

```typescript
// Linha 1164 - PROBLEMA: herda o booked_by do parent
inheritedBookedBy = parentData?.booked_by || null;
// ...
// Linha 1177 - insere com o booked_by herdado
booked_by: inheritedBookedBy,
```

Isso significa que se **Carol Souza** agendou o lead original, e depois **Evellyn** adiciona o sócio desse lead, o sócio fica com `booked_by = Carol Souza` em vez de `booked_by = Evellyn`.

Como o `booked_by` é usado para atribuição de SDR nas métricas e na jornada do lead, o sócio aparece nos números de Carol Souza.

### Solução
Alterar `useAddMeetingAttendee` para usar o **usuário logado atual** (`auth.uid()`) como `booked_by` do sócio, em vez de herdar do parent. O `deal_id` continua sendo herdado (correto, pois o sócio compartilha o mesmo deal).

### Alteração
**`src/hooks/useAgendaData.ts`** — na função `useAddMeetingAttendee`:
- Obter o `user.id` atual via `supabase.auth.getUser()`
- Usar o user ID do usuário logado como `booked_by` para o sócio
- Manter herança de `deal_id` do parent (comportamento correto)

### Impacto
- Sócios adicionados a partir dessa correção terão o SDR correto (quem realmente adicionou)
- Sócios já existentes com `booked_by` errado **não** serão corrigidos automaticamente (pode ser feito via SQL se necessário)
- Nenhuma alteração no banco de dados necessária

