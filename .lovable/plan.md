

## Diagnóstico: Badge No-Shows (17) vs Lista (5 leads)

O badge "17" na aba No-Shows usa o hook `useR2NoShowsCount()` que conta **todos os no-shows dos últimos 30 dias** (sem filtro de data/closer).

Já a lista exibida usa `useR2NoShowLeads()` que filtra pelo **período selecionado** nos filtros (Dia/Semana/Mês/Personalizado). No screenshot, o período está configurado para "Semana" ou "Mês" de março, mostrando apenas 5 no-shows desse intervalo.

### Plano de correção

**Arquivo: `src/hooks/useR2NoShowLeads.ts` (função `useR2NoShowsCount`)**

Alterar a contagem do badge para usar o mesmo período que a lista mostra por padrão (mês atual), ao invés de "últimos 30 dias". OU, alternativamente:

**Arquivo: `src/pages/crm/AgendaR2.tsx`**

Passar os parâmetros de data ativos para `useR2NoShowsCount` de modo que o badge reflita o mesmo filtro de período que a lista. Isso requer:

1. Modificar `useR2NoShowsCount` para aceitar parâmetros de data opcionais (`startDate`, `endDate`)
2. Passar `rangeStart`/`rangeEnd` da AgendaR2 para o hook
3. Quando sem parâmetros (fallback), usar mês atual ao invés de 30 dias

Isso garante que o badge e a lista mostrem o mesmo número.

