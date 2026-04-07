

# Mostrar indicadores completos no Meu Fechamento

## Problema
A visao do SDR/Closer no "Meu Fechamento" mostra apenas um resumo simplificado (% e multiplicador em caixinhas pequenas). O admin ve os indicadores completos com meta, realizado, barra de progresso, faixa e calculo do valor. O SDR/Closer precisa ver a mesma coisa.

## Solucao

Reutilizar o componente `DynamicIndicatorsGrid` (ja usado na pagina de detalhe do admin) dentro de `SdrFechamentoView` e `CloserFechamentoView`. Para isso, buscar os dados necessarios (KPI e metricas ativas) que hoje nao sao carregados no `useOwnFechamento`.

### Alteracoes

**1. `src/hooks/useOwnFechamento.ts`**
- Adicionar busca de `sdr_month_kpi` para o mes selecionado (query simples por `sdr_id` + `ano_mes`)
- Retornar `kpi: SdrMonthKpi | null` no resultado do hook

**2. `src/components/fechamento/SdrFechamentoView.tsx`**
- Importar `useActiveMetricsForSdr` e `DynamicIndicatorsGrid`
- Receber `sdrId` e `anoMes` como props adicionais
- Buscar metricas ativas via `useActiveMetricsForSdr(sdrId, anoMes)`
- Substituir a secao "Resumo dos Indicadores" (caixinhas simplificadas) pelo `DynamicIndicatorsGrid` com os mesmos cards completos que o admin ve (meta, realizado, barra de progresso, faixa, multiplicador, valor)
- Manter os summary cards de OTE/Fixo/Variavel/Total no topo

**3. `src/components/fechamento/CloserFechamentoView.tsx`**
- Mesma logica: importar `useActiveMetricsForSdr` e `DynamicIndicatorsGrid`
- Receber `sdrId` e `anoMes` como props
- Substituir a secao "Indicadores de Performance" pelo `DynamicIndicatorsGrid`
- Manter summary cards e metricas secundarias (taxa conversao, outside sales, R2) que nao fazem parte dos indicadores de variavel

**4. `src/pages/fechamento-sdr/MeuFechamento.tsx`**
- Passar `sdrId={userRecord.id}` e `anoMes={selectedMonth}` para `SdrFechamentoView` e `CloserFechamentoView`
- Buscar e passar `kpi` do hook (ou deixar os views buscarem internamente)

### Dados necessarios

O `DynamicIndicatorsGrid` precisa de:
- `metricas`: vem de `useActiveMetricsForSdr(sdrId, anoMes)`
- `kpi`: buscar `sdr_month_kpi` por `sdr_id` + `ano_mes`
- `payout`: ja disponivel
- `diasUteisMes`: vem de `payout.dias_uteis_mes`
- `sdrMetaDiaria`: vem de `payout.sdr.meta_diaria`
- `variavelTotal`: vem do comp plan ou payout

### Resultado
O SDR/Closer vera exatamente os mesmos cards de indicadores que o admin ve na pagina de detalhe: meta, realizado, barra de progresso colorida, faixa, multiplicador e valor calculado.

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useOwnFechamento.ts` | Adicionar query de KPI, retornar no resultado |
| `src/components/fechamento/SdrFechamentoView.tsx` | Usar DynamicIndicatorsGrid em vez do resumo simplificado |
| `src/components/fechamento/CloserFechamentoView.tsx` | Usar DynamicIndicatorsGrid em vez do resumo simplificado |
| `src/pages/fechamento-sdr/MeuFechamento.tsx` | Passar props extras (sdrId, anoMes, kpi) para os views |

