

# Adicionar métricas de Comissão Consórcio/Holding na lista de métricas disponíveis

## Problema

A lista `METRICAS_DISPONIVEIS` em `src/types/sdr-fechamento.ts` contém apenas métricas genéricas de SDR (Agendamentos, R1 Realizadas, Contratos, etc.). Faltam as métricas específicas de Closers Consórcio:
- **Comissão Consórcio** (valor de comissão gerada em vendas de consórcio)
- **Comissão Holding** (valor de comissão gerada em vendas holding)

Por isso, na aba "Métricas Ativas" com cargo "Closer Consórcio", o usuário não consegue ativar essas métricas nem definir seus pesos (ex: 90% comissão consórcio, 10% organização).

## Solução

### Arquivo 1: `src/types/sdr-fechamento.ts`

Adicionar duas entradas ao array `METRICAS_DISPONIVEIS`:
- `{ nome: 'comissao_consorcio', label: 'Comissão Venda Consórcio', fonte: 'manual' }`
- `{ nome: 'comissao_holding', label: 'Comissão Venda Holding', fonte: 'manual' }`

### Arquivo 2: `src/hooks/useActiveMetricsForSdr.ts`

Adicionar `comissao_consorcio` e `comissao_holding` ao `METRIC_CONFIG` com os campos corretos (`kpiField`, `icon`, `color`), para que o sistema saiba mapear essas métricas nos cálculos.

### Arquivo 3: `src/hooks/useCalculatedVariavel.ts`

Na função `calcularMeta`, adicionar cases para `comissao_consorcio` e `comissao_holding` que busquem a meta individual do `comp_plan` (campo `meta_comissao_consorcio` / `meta_comissao_holding`) em vez de usar meta diaria x dias uteis.

## Resultado esperado
- Na aba "Métricas Ativas" para Closer Consórcio, aparecem "Comissão Venda Consórcio" e "Comissão Venda Holding" para ativar com peso
- O recálculo do fechamento usa essas métricas configuradas com os pesos corretos
- Organização continua disponível como métrica complementar

