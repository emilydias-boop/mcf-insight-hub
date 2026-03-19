

## Plano: Bloquear agendamento em slots lotados

### Problema
O botão "UserPlus" (adicionar lead) e o botão "Livre" continuam clicáveis mesmo quando o slot já atingiu a capacidade máxima. O indicador "Lotado" é visual mas não impede a ação.

### Alterações

| Arquivo | O que muda |
|---------|------------|
| `src/components/crm/CloserColumnCalendar.tsx` | Ocultar botão `UserPlus` quando `totalAttendees >= maxLeads`. O botão "Livre" já não aparece (branch `available` é `false`), então está OK. |
| `src/components/crm/AgendaCalendar.tsx` | (1) Day view: ocultar botão de slot disponível quando capacidade atingida. (2) Day view: ocultar botão `onAddToMeeting` quando lotado. (3) Week view: ocultar botões de slot livre quando todos os closers estão lotados. |

### Detalhes

**CloserColumnCalendar (linha ~516-527)** — O botão `UserPlus` que aparece ao hover sobre meetings:
- Envolver com condição: só mostrar se `totalAttendees < maxLeads` (usando `getSlotCapacityInfo`)

**AgendaCalendar — Day view (linha ~1787)** — Botão `onAddToMeeting` sobre meetings:
- Calcular capacidade do closer no slot e ocultar se lotado

**AgendaCalendar — Day view (linha ~1156)** — Botão de slot disponível por closer:
- Verificar capacidade antes de exibir o botão "disponível"

**AgendaCalendar — Week view (linhas ~1369, ~1431, ~1827)** — Botões de slot livre:
- Verificar capacidade do closer e não mostrar se lotado

A lógica de capacidade usa `getSlotCapacityInfo` (já existe no CloserColumnCalendar) e `getSlotCapacityStatus` (já existe no AgendaCalendar). Apenas condicionais extras nos botões.

