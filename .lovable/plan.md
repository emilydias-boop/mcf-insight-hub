
# Corrigir "Leads por Reunião" no Calendário R1

## Problema

O slider "Leads por Reunião" salva corretamente o valor `max_leads_per_slot` no banco de dados, mas a lógica de disponibilidade do calendário **ignora esse valor**.

Atualmente, a funcao `isSlotAvailable` em `CloserColumnCalendar.tsx` (linha 166) faz:

```text
return hasMeetings.length === 0;
```

Ou seja, se ja existe **qualquer** reuniao no horario, o slot e marcado como indisponivel -- independentemente de quantos leads foram configurados como maximo.

## Solucao

Alterar a verificacao para considerar o `max_leads_per_slot` do closer:

```text
// Em vez de: hasMeetings.length === 0
// Usar: total de attendees no slot < max_leads_per_slot do closer
```

### Detalhes Tecnicos

**Arquivo:** `src/components/crm/CloserColumnCalendar.tsx`

**Alteracao na funcao `isSlotAvailable` (linhas 157-167):**

1. Buscar o closer correspondente ao `closerId` para obter o `max_leads_per_slot`
2. Contar o total de attendees (nao de meetings) no slot -- pois uma reuniao pode ter multiplos attendees
3. Comparar esse total com `max_leads_per_slot` do closer
4. Retornar `true` se ainda ha capacidade

Logica atualizada (pseudo-codigo):
```text
isSlotAvailable(closerId, slotTime):
  se bloqueado -> false
  se nao configurado -> false
  closer = closers.find(c => c.id === closerId)
  maxLeads = closer.max_leads_per_slot ou 4
  meetingsNoSlot = getMeetingsForSlot(closerId, slotTime)
  totalAttendees = soma de attendees de todos os meetings no slot
  return totalAttendees < maxLeads
```

**Impacto visual no calendario:**
- Quando `max_leads_per_slot = 1` (como na screenshot): comportamento atual, um lead por horario
- Quando `max_leads_per_slot > 1`: o botao "+" de agendar continua visivel mesmo quando ja existe uma reuniao, ate atingir o limite

**Nenhuma alteracao de banco de dados necessaria** -- os dados ja estao corretos, apenas a logica do frontend precisa ser ajustada.
