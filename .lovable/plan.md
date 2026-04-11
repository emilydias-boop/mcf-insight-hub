

# Plano: Alinhar datas do Funil Pós-Venda com o Carrinho R2

## Problema atual

O `useCarrinhoAnalysisReport` chama `getCarrinhoMetricBoundaries(startDate, endDate)` **sem** passar `config` e `previousConfig`, então sempre usa o corte padrão de 12:00. O Carrinho R2 passa ambas as configs para respeitar o `horario_corte` dinâmico de cada semana.

Além disso, o `PostSaleFunnelPanel` recebe `data.leads` (sem filtros) em vez de `filteredLeads`.

## Alterações

### 1. `CarrinhoAnalysisReportPanel.tsx` — Integrar `useCarrinhoConfig`
- Importar `useCarrinhoConfig` e calcular `prevWeekStart`
- Passar `config` e `prevConfig` para o hook `useCarrinhoAnalysisReport`
- Passar `filteredLeads` (em vez de `data.leads`) para o `PostSaleFunnelPanel`

### 2. `useCarrinhoAnalysisReport.ts` — Aceitar configs
- Adicionar parâmetros opcionais `config?: CarrinhoConfig` e `previousConfig?: CarrinhoConfig`
- Passar para `getCarrinhoMetricBoundaries(startDate, endDate, config, previousConfig)`
- Incluir cutoff keys no `queryKey` para reatividade

### 3. Resultado
As janelas de data (contratos, R2, aprovados, vendas parceria) ficarão idênticas às do Carrinho R2, respeitando o `horario_corte` configurado para cada semana.

