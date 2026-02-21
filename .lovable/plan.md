
# Fix: Horarios de Domingo Nao Aparecem na Agenda

## Causa Raiz

O banco de dados armazena Domingo como `day_of_week = 0`. Porem, o codigo em varios pontos converte Domingo de `0` para `7` antes de buscar os slots configurados:

```
const dayOfWeek = day.getDay() === 0 ? 7 : day.getDay();
const slots = meetingLinkSlots?.[dayOfWeek] || []; // meetingLinkSlots[7] = undefined!
```

O hook `useUniqueSlotsForDays` retorna dados indexados pela chave do banco (`0` para Domingo), mas o codigo consumidor busca na chave `7`, que nao existe. Resultado: slots de Domingo nunca aparecem.

## Locais Afetados

| Arquivo | Linha | Conversao errada |
|---------|-------|-----------------|
| `src/components/crm/AgendaCalendar.tsx` | 452 | `isSlotConfigured` - slots nao aparecem como configurados |
| `src/components/crm/AgendaCalendar.tsx` | 483 | `isSlotAvailable` - slots nao aparecem como disponiveis |
| `src/components/crm/AgendaCalendar.tsx` | 554 | `getCloserSlotsForDay` - nao gera linhas de horario para Domingo |
| `src/components/crm/CloserColumnCalendar.tsx` | 95 | `useCloserDaySlots(7)` - busca no DB com `day_of_week = 7`, retorna vazio |
| `src/hooks/useAgendaData.ts` | 389 | Metricas de Domingo usam dia 7 |

## Solucao

Remover a conversao `0 -> 7` em todos os pontos. Domingo deve permanecer como `0`, consistente com o banco de dados e com `getDay()` do JavaScript.

### Mudancas

**AgendaCalendar.tsx** - 3 linhas (452, 483, 554):
```
// ANTES
const dayOfWeek = day.getDay() === 0 ? 7 : day.getDay();

// DEPOIS
const dayOfWeek = day.getDay();
```

**CloserColumnCalendar.tsx** - 1 linha (95):
```
// ANTES
const dayOfWeek = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay();

// DEPOIS
const dayOfWeek = selectedDate.getDay();
```

**useAgendaData.ts** - 1 linha (389):
```
// ANTES
const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();

// DEPOIS
const dayOfWeek = date.getDay();
```

## Impacto

- 5 linhas alteradas em 3 arquivos
- Nenhuma mudanca na interface ou comportamento para dias 1-6 (segunda a sabado)
- Domingo passa a mostrar corretamente os horarios configurados no grid da Agenda
