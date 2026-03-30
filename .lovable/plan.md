

## Corrigir exibição de desligados e cálculo proporcional no fechamento

### Problemas identificados

**1. Evellyn e Hellen não aparecem na listagem**
- `useSdrFechamento.ts` linha 278: `result.filter(p => p.sdr?.active !== false)` — remove SDRs inativos da listagem
- `useSdrFechamento.ts` linha 226: `.eq('status', 'ativo')` — busca apenas employees ativos, então desligados não têm dados de cargo/departamento

**2. Evellyn com data_admissao errada**
- No banco: `data_admissao = 22026-02-02` (ano 22026 em vez de 2026)
- Isso faz `dataInicioEfetiva` ser no futuro, resultando em `dias_uteis_trabalhados = 0` e todos valores zerados
- Precisa corrigir no banco para `2026-02-02`

**3. Individual não calcula variável proporcional**
- A Edge Function aplica pro-rata apenas no `valor_fixo` e `ifood_mensal`
- As metas (agendamentos, tentativas etc.) não são ajustadas proporcionalmente
- O `useCalculatedVariavel` no frontend também não considera `dias_uteis_trabalhados` para ajustar metas

### Mudanças

#### 1. `src/hooks/useSdrFechamento.ts` — Incluir desligados na listagem
- Linha 226: Remover `.eq('status', 'ativo')` e buscar também employees desligados com `data_demissao` no mês selecionado (ou simplesmente remover o filtro de status)
- Linha 278: Mudar filtro para permitir SDRs inativos que tenham payout no mês (se o payout existe, deve aparecer)

#### 2. Corrigir `data_admissao` da Evellyn no banco
- Migration: `UPDATE employees SET data_admissao = '2026-02-02' WHERE data_admissao = '22026-02-02'`

#### 3. Edge Function `recalculate-sdr-payout` — Pro-rata nas metas
- Após calcular `ratioProRata`, aplicar proporcionalmente em `meta_agendadas_ajustada` e `meta_tentativas_ajustada`
- Isso faz o cálculo de variável usar metas proporcionais (ex: meta 154 × 16/22 = 112)

#### 4. `src/hooks/useCalculatedVariavel.ts` — Considerar pro-rata
- Quando `payout.dias_uteis_trabalhados` existe e é menor que `diasUteisMes`, ajustar metas fixas (agendamentos, tentativas) proporcionalmente no cálculo local

### Arquivos alterados
1. `src/hooks/useSdrFechamento.ts` — incluir desligados na listagem e busca de employees
2. `supabase/migrations/XXXX_fix_evellyn_admissao.sql` — corrigir data errada
3. `supabase/functions/recalculate-sdr-payout/index.ts` — pro-rata nas metas
4. `src/hooks/useCalculatedVariavel.ts` — cálculo local com pro-rata

