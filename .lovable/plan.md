

# Aplicar horário de corte na aba "Todas R2s" (agendadas)

## Problema

A boundary `r2Meetings` vai até o **final do dia** da sexta-feira do carrinho atual (`friCurrentCart = endOfDay(wedEnd + 2)`). Isso significa que reuniões agendadas **após o horário de corte** na sexta aparecem no carrinho da semana atual, quando deveriam pertencer à próxima semana.

O horário de corte só é aplicado na boundary `aprovados`, mas não em `r2Meetings` -- que é usada por `agendadas`, `no_show`, `realizadas` e pelos KPIs.

## Solução

Criar uma nova boundary `r2MeetingsCutoff` que respeita o horário de corte na sexta, e usá-la em todos os filtros que alimentam a grade do carrinho.

| Arquivo | Alteração |
|---|---|
| `src/lib/carrinhoWeekBoundaries.ts` | Alterar `r2Meetings.end` para usar o horário de corte da sexta (`friCartCutoff`) em vez de `endOfDay(friCurrentCart)` |
| `src/hooks/useR2CarrinhoKPIs.ts` | Os KPIs de R2 (agendadas, realizadas, etc.) passarão a respeitar o corte automaticamente via a boundary corrigida |

### Alteração principal (`carrinhoWeekBoundaries.ts`)

```typescript
// ANTES (linha 105):
r2Meetings: { start: friAfterPrevCart, end: friCurrentCart },

// DEPOIS:
r2Meetings: { start: friAfterPrevCart, end: friCartCutoff },
```

Isso faz com que **todas** as queries que usam `boundaries.r2Meetings` (agendadas, no_show, realizadas, KPIs) respeitem o horário de corte configurado. Reuniões após o corte na sexta pertencerão ao carrinho da próxima semana.

A boundary `aprovados` já usa `friCartCutoff`, então não muda. A boundary de `vendasParceria` continua independente (Sex 00:00 → Seg 23:59).

