## Problema

No card **Próxima Semana** da safra atual (30/04 → 06/05) aparece **0**, mas existem 3 leads (Alexsandro, Jeferson, Maria) que pagaram contrato nesta safra e têm R2 agendada na próxima safra (07/05 → 13/05). Eles deveriam aparecer no contador.

## Causa raiz

`useR2CarrinhoKPIs.proximaSemana` é calculado iterando `unifiedData`, que vem da RPC `get_carrinho_r2_attendees` chamada com janela `[carrinhoOperacional.start, r2Meetings.end]` — ou seja, **somente Qui 00:00 → Qua 23:59 da safra atual**.

Leads cuja R2 está agendada **depois** do `wedEnd` (próxima safra) nunca entram no `unifiedData`. A condição `isAfterCurrentCutoff(row)` em `useR2CarrinhoKPIs.ts:295` nunca é atingida porque esses rows simplesmente não estão no array.

## Correção

Em `src/hooks/useCarrinhoUnifiedData.ts`, estender a janela enviada para a RPC para também cobrir a **próxima safra** (mais 7 dias após `wedEnd`), de modo que leads com R2 agendada na próxima semana sejam carregados.

```ts
// useCarrinhoUnifiedData.ts (queryFn)
const nextSafraEnd = addDays(boundaries.r2Meetings.end, 7);

const { data, error } = await supabase.rpc('get_carrinho_r2_attendees', {
  p_week_start: weekStartStr,
  p_window_start: boundaries.carrinhoOperacional.start.toISOString(),
  p_window_end: nextSafraEnd.toISOString(),   // ← estender +7d
  p_apply_contract_cutoff: true,
  p_previous_cutoff: boundaries.carrinhoOperacional.start.toISOString(),
});
```

E garantir que os outros KPIs operacionais (R2 Agendadas, R2 Realizadas, Fora do Carrinho, No-Show, Semanas Anteriores) **continuem usando `inOperationalWindow(row)`** — eles já filtram por `opEnd` da safra atual, então a extensão da janela de fetch não os contamina. Apenas o `proximaSemana` (que já usa `isAfterCurrentCutoff`) passará a enxergar esses leads.

Adicionalmente, o filtro de "Próxima Semana" deve **limitar ao final da próxima safra** para não contar leads agendados muito longe (ex: 2 semanas à frente):

```ts
const nextSafraEndTs = addDays(carrinhoOperacional.end, 7).getTime();
const isInNextSafra = (row: CarrinhoLeadRow) => {
  if (!row.scheduled_at) return false;
  const t = new Date(row.scheduled_at).getTime();
  return t >= opEnd && t <= nextSafraEndTs;
};
// substituir isAfterCurrentCutoff(row) por isInNextSafra(row) na linha 295
```

## Validação

Após ajuste, na safra 30/04→06/05 o card **Próxima Semana** deve passar de **0 → 3** (Alexsandro 07/05, Jeferson 11/05, Maria 12/05), e o tooltip/lista deve mostrar esses leads.

## Não muda

- Lógica de Contratos, Semanas Anteriores, R2 Agendadas/Realizadas, No-Show, Reembolso, Aprovados — todos continuam restritos à janela operacional via `opOk`.
- RPC `get_carrinho_r2_attendees` não muda.
- Não toca no Carrinho da próxima semana (já mostra esses 3 corretamente).
