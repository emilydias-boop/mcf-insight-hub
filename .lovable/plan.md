

## Diagnóstico: Diferença entre KPIs e aba "Todas R2s"

### Fontes de dados

| Dado | Hook | Fonte |
|---|---|---|
| **Contratos (R1) = 59** | `useR2CarrinhoKPIs` | `hubla_transactions` com `product_name = 'A000 - Contrato'` na safra (Qui-Qua) |
| **R2 Agendadas = 61** | `useR2CarrinhoKPIs` | `meeting_slot_attendees` no window operacional (Sex-Sex) + encaixados, exclui cancelled/rescheduled |
| **Todas R2s = 56** | `useR2CarrinhoData` | Mesma tabela, mas com filtros extras |

### Causa da diferença (61 vs 56 = 5 leads)

O KPI `R2 Agendadas` e a lista `Todas R2s` usam **lógicas de merge diferentes**:

1. **KPI** (`useR2CarrinhoKPIs`): Busca attendees no window operacional + encaixados e faz dedup por `deal_id`, mas **não filtra** attendees que foram "encaixados para outra semana" (com `carrinho_week_start` de outra semana).

2. **Lista** (`useR2CarrinhoData`): Na função `fetchAttendeesFromQuery`, há a linha:
   ```ts
   if (attWeekStart && weekStartStr && attWeekStart !== weekStartStr) continue;
   ```
   Isso **exclui** attendees que têm `carrinho_week_start` definido para uma semana diferente. O KPI não tem esse filtro.

Ou seja, ~5 leads têm `carrinho_week_start` apontando para outra semana, então aparecem no KPI mas não na lista.

### Sobre Safra vs Semana

A aba "Todas R2s" mostra R2 meetings da **janela operacional** (definida por `getCarrinhoMetricBoundaries`, que é Sex a Sex com base no `horario_corte`), **não** da safra (Qui-Qua). Já os Contratos (R1) vêm da safra.

### Plano de correção

Alinhar o KPI `R2 Agendadas` com a lista `Todas R2s`, aplicando o mesmo filtro de `carrinho_week_start`:

**`src/hooks/useR2CarrinhoKPIs.ts`**:
1. Na query principal de `r2AttendeesResult`, adicionar a mesma lógica de exclusão: se um attendee tem `carrinho_week_start` definido e diferente da semana atual, excluí-lo da contagem
2. Para isso, incluir `carrinho_week_start` no select da query
3. No loop de merge (`mergedR2`), filtrar attendees regulares (não encaixados) que tenham `carrinho_week_start` apontando para outra semana

### Seção técnica

```ts
// No useR2CarrinhoKPIs.ts, ao fazer merge dos r2Attendees regulares:
for (const att of r2AttendeesResult.data || []) {
  const key = (att as any).deal_id || att.id;
  const attWeekStart = (att as any).carrinho_week_start;
  // Skip se encaixado em outra semana (mesmo filtro do useR2CarrinhoData)
  if (attWeekStart && attWeekStart !== weekStartStr) continue;
  if (!r2LeadKeys.has(key) && !r2AttendeeIds.has(att.id)) {
    r2LeadKeys.set(key, att);
    r2AttendeeIds.add(att.id);
  }
}
```

Preciso adicionar `carrinho_week_start` ao select das queries em `useR2CarrinhoKPIs` (workaround com cast, como já feito para encaixados).

