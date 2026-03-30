

## Fechamento pro-rata para desligados e novos colaboradores

### Problema
O sistema calcula o fechamento usando o mês inteiro (dia 1 ao último dia) para todos os colaboradores, sem considerar:
- **Desligados** (Evellyn, Juliana, Hellen): devem ter métricas e remuneração calculadas apenas do dia 1 até a `data_demissao`
- **Novos**: devem ter métricas e remuneração calculadas apenas da `data_admissao` até o fim do mês

Hoje não existe nenhuma lógica de pro-rata no sistema — nem na Edge Function (`recalculate-sdr-payout`) nem no cálculo local (`useCalculatedVariavel`).

### Solução

Adicionar lógica de **pro-rata por dias úteis trabalhados** na Edge Function e no frontend.

#### 1. Edge Function `supabase/functions/recalculate-sdr-payout/index.ts`

Após buscar o `employeeData` (linha ~598), adicionar:
- Buscar `data_admissao` e `data_demissao` do employee
- Calcular `data_inicio_efetiva` = max(início do mês, `data_admissao`)
- Calcular `data_fim_efetiva` = min(fim do mês, `data_demissao` ou fim do mês)
- Calcular `dias_uteis_trabalhados` vs `dias_uteis_mes` total
- Usar `data_inicio_efetiva` e `data_fim_efetiva` como range para buscar métricas (RPC e slots de Closer)
- Aplicar pro-rata no **fixo**: `fixo_valor * (dias_uteis_trabalhados / dias_uteis_mes)`
- Aplicar pro-rata no **iFood mensal**: `ifood * (dias_uteis_trabalhados / dias_uteis_mes)`
- Ajustar **metas** proporcionalmente: `meta * (dias_uteis_trabalhados / dias_uteis_mes)`
- Persistir `dias_uteis_trabalhados` no payout para auditoria

Também buscar employees com `status = 'desligado'` e `data_demissao` dentro do mês (atualmente a query filtra `status = 'ativo'`, linha 602).

#### 2. Tabela `sdr_month_payout` — nova coluna
- Adicionar `dias_uteis_trabalhados` (integer, nullable) para registrar quantos dias úteis o colaborador efetivamente trabalhou
- Migration SQL simples

#### 3. Frontend — `src/components/fechamento/PayoutTableRow.tsx`
- Mostrar indicador visual quando `dias_uteis_trabalhados < dias_uteis_mes` (badge "Proporcional" ou tooltip)

#### 4. Frontend — `src/pages/fechamento-sdr/Detail.tsx`
- Exibir info de pro-rata no cabeçalho: "Período efetivo: 01/03 a 15/03 (X dias úteis de Y)"

#### 5. Frontend — `src/hooks/useCalculatedVariavel.ts`
- Considerar pro-rata quando `dias_uteis_trabalhados` estiver preenchido no payout
- Ajustar fixo e metas proporcionalmente

#### 6. Edge Function — buscar desligados
- Na query de SDRs (linha 449), o filtro `active = true` pode excluir desligados
- Adicionar lógica: buscar também SDRs com employee desligado no mês corrente (`data_demissao` entre monthStart e monthEnd), mesmo que `sdr.active = false`

### Prioridade (urgência)
A implementação começa pela Edge Function, que é o que gera os números do fechamento ao clicar "Recalcular Todos".

### Arquivos alterados
1. `supabase/functions/recalculate-sdr-payout/index.ts` — pro-rata + buscar desligados
2. `supabase/migrations/XXXX_add_dias_uteis_trabalhados.sql` — nova coluna
3. `src/types/sdr-fechamento.ts` — adicionar campo ao tipo
4. `src/hooks/useCalculatedVariavel.ts` — pro-rata no cálculo local
5. `src/components/fechamento/PayoutTableRow.tsx` — badge proporcional
6. `src/pages/fechamento-sdr/Detail.tsx` — exibir período efetivo

