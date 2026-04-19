
## Bug confirmado: "Todo Período" cai no fallback do mês

### Causa raiz

**Arquivo:** `src/pages/bu-consorcio/Index.tsx` linhas 175-191

```ts
const filters = {
  startDate: dateRangeFilter.startDate || startDate,  // ← startDate = mês atual
  endDate:   dateRangeFilter.endDate   || endDate,    // ← endDate   = mês atual
  ...
};
```

Quando o usuário clica **"Todo Período"**, o `ConsorcioPeriodFilter` envia `startDate: undefined` e `endDate: undefined` (correto). Mas o `||` substitui `undefined` pelas datas do `monthOffset` (mês atual) — ou seja, o filtro vira "mês de abril" silenciosamente.

O hook `useConsorcioCards` já trata `undefined` corretamente (não aplica `gte/lte`), então basta deixar `undefined` passar.

### Como diferenciar "nada selecionado" vs "Todo Período"

Hoje o estado inicial também tem `startDate/endDate: undefined` — e nesse caso o usuário espera ver o mês default. Precisamos diferenciar os dois casos.

**Solução:** usar a `label` do `dateRangeFilter` como sinal explícito:
- `label === 'Todo Período'` → não aplicar nenhum filtro de data (passa `undefined`)
- `label === 'Período'` (estado inicial) → usar fallback do mês selecionado
- Qualquer outra label (semana, mês, custom) → usar `startDate`/`endDate` do filtro

### Plano de correção

**Arquivo:** `src/pages/bu-consorcio/Index.tsx` (linhas 175-191)

Substituir a lógica para considerar o caso "Todo Período":

```ts
const isTodoPeriodo = dateRangeFilter.label === 'Todo Período';
const isPeriodoCustom = dateRangeFilter.startDate || dateRangeFilter.endDate;

const dateFilters = isTodoPeriodo
  ? { startDate: undefined, endDate: undefined }
  : isPeriodoCustom
    ? { startDate: dateRangeFilter.startDate, endDate: dateRangeFilter.endDate }
    : { startDate, endDate };  // fallback no mês

const filters = {
  ...dateFilters,
  status: ...,
  // demais filtros
};
```

E aplicar a mesma lógica no `useConsorcioSummary` (linhas 188-191) para os KPIs também refletirem "Todo Período".

### Resultado esperado

| Ação do usuário | Comportamento |
|---|---|
| Página recém-aberta (sem filtro) | Mostra o mês selecionado no dropdown (igual hoje) |
| Clica "Todo Período" | Mostra **todas as cotas de todas as datas** ✅ |
| Clica "Esta Semana" / "Mês Ant." | Aplica esse range específico |
| Período customizado | Aplica o range escolhido |
| Limpa o filtro (X) | Volta ao default do mês selecionado |

### Garantias
- Sem alteração no banco
- Sem alteração nos hooks `useConsorcioCards` / `useConsorcioSummary` (já tratam undefined)
- Sem impacto nos demais filtros (status, tipo, vendedor, etc.)
- Cards e KPIs vão refletir a mesma lógica de período
