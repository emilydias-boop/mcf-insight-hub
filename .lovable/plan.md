## Problema

No painel `/crm/reunioes-equipe`, ao selecionar o preset **Custom** com a mesma data inicial e final (ex.: `start=2026-05-12&end=2026-05-12`), a tabela "Atividades por SDR" exibe "Nenhuma atividade encontrada no período selecionado".

## Causa raiz

Em `src/pages/crm/ReunioesEquipe.tsx`, função `getDateRange()`:

```ts
case "custom": {
  const startCustom = customStartDate || startOfMonth(today);
  const endCustom = customEndDate || customStartDate || endOfMonth(today);
  if (startCustom > endCustom) return { start: endCustom, end: startCustom };
  return { start: startCustom, end: endCustom };
}
```

`customStartDate` e `customEndDate` são inicializados via `parseYmdLocal(...)`, que retorna a data à **meia-noite local** (ex.: `2026-05-12 00:00:00`). Quando início = fim = mesmo dia, o intervalo enviado ao hook `useSdrActivityMetrics` é de duração zero, então o filtro `created_at >= start AND created_at <= end` não encontra nada (atividades acontecem após 00:00:00).

Os demais cases (`today`, `week`) já normalizam com `startOfDay`/`endOfDay`. Apenas o `custom` ficou sem essa normalização.

## Correção

Em `src/pages/crm/ReunioesEquipe.tsx`, no case `"custom"` de `getDateRange()`, envolver com `startOfDay`/`endOfDay`:

```ts
case "custom": {
  const startCustom = customStartDate || startOfMonth(today);
  const endCustom = customEndDate || customStartDate || endOfMonth(today);
  const s = startOfDay(startCustom);
  const e = endOfDay(endCustom);
  return s > e ? { start: e, end: s } : { start: s, end: e };
}
```

Isso garante que um custom de "12/05 a 12/05" cubra `00:00:00.000` até `23:59:59.999`, alinhando com os demais presets e fazendo a tabela "Atividades por SDR" (e qualquer outro consumer que use o intervalo) retornar dados corretamente.

## Validação

1. Acessar `/crm/reunioes-equipe?preset=custom&start=2026-05-12&end=2026-05-12`.
2. A aba "SDRs" → "Atividades por SDR" deve listar as ligações/notas/movimentos do dia.
3. Confirmar que intervalos custom multi-dia continuam funcionando normalmente.
