
# Fix: Visualizacao Semanal Quebrada com Domingo

## Causa Raiz

Na linha 870 do `AgendaCalendar.tsx`, o grid da semana esta fixo em **6 colunas**:

```ts
const gridCols = viewMode === 'day' 
  ? `grid-cols-[60px_repeat(${numCloserColumns},1fr)]`
  : 'grid-cols-[60px_repeat(6,1fr)]';  // <-- sempre 6
```

Porem, quando o Domingo tem dados (slots ou reunioes), `includeSunday` fica `true` e `viewDays` retorna **7 dias** (Sab, Dom, Seg, Ter, Qua, Qui, Sex). O grid com 6 colunas nao comporta 7 dias, fazendo a Sexta-feira "cair" para uma nova linha e quebrar toda a visualizacao.

## Solucao

Tornar o numero de colunas dinamico baseado na quantidade real de dias em `viewDays`:

```ts
const gridCols = viewMode === 'day' 
  ? `grid-cols-[60px_repeat(${numCloserColumns},1fr)]`
  : `grid-cols-[60px_repeat(${viewDays.length},1fr)]`;
```

## Arquivo Modificado

| Arquivo | Linha | Mudanca |
|---------|-------|---------|
| `src/components/crm/AgendaCalendar.tsx` | 870 | Trocar `repeat(6,1fr)` por `repeat(${viewDays.length},1fr)` |

Uma unica linha alterada. Quando o Domingo estiver incluido, o grid tera 7 colunas; caso contrario, mantem 6.
