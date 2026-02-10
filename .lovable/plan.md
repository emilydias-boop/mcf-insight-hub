

# Adicionar Seletor de Pipeline no Painel de Equipe do Consorcio

## O que muda
Um dropdown (seletor) sera adicionado na barra de filtros do Painel de Equipe do Consorcio, permitindo alternar entre as pipelines para visualizar metricas especificas de cada uma.

## Pipelines disponiveis no seletor
- **Todos** (padrao) -- mostra metricas consolidadas de todas as pipelines do Consorcio
- **Efeito Alavanca + Clube** -- mostra apenas metricas desta pipeline
- **Pipeline Viver de Aluguel** -- mostra apenas metricas desta pipeline

## Comportamento
Ao trocar a pipeline no seletor:
- As tabelas de SDRs e Closers filtram os dados pela pipeline selecionada
- Os KPI cards refletem apenas os numeros da pipeline escolhida
- O painel de metas (GoalsPanel) continua mostrando os dados gerais (agenda)

## Detalhes Tecnicos

### Arquivo: `src/pages/bu-consorcio/PainelEquipe.tsx`

1. **Adicionar estado** `selectedPipelineId` para controlar a pipeline selecionada
2. **Importar** `PipelineSelector` de `@/components/crm/PipelineSelector` e o hook `useBUPipelineMap` de `@/hooks/useBUPipelineMap`
3. **Renderizar o seletor** na barra de filtros (ao lado do filtro de SDR), passando `allowedGroupIds` com os grupos mapeados para a BU Consorcio
4. **Passar `selectedPipelineId`** para os hooks `useTeamMeetingsData` e `useR1CloserMetrics` para que filtrem os dados pela pipeline selecionada (ou filtrar no lado do cliente com os dados ja carregados)

### Mudancas nos hooks (se necessario)

Se os hooks `useTeamMeetingsData` e `useR1CloserMetrics` nao suportarem filtro por pipeline/origin, sera feita uma filtragem no lado do cliente:
- Cruzar os `origin_id` dos meetings/deals com as origens da pipeline selecionada
- Usar o hook `useCRMOriginsByPipeline` para obter os origin IDs da pipeline escolhida

### Componente PipelineSelector
O componente `PipelineSelector` ja existe em `src/components/crm/PipelineSelector.tsx` e sera reutilizado diretamente. Ele ja suporta `allowedGroupIds` para filtrar por BU.

### Fluxo de dados

```text
PipelineSelector (dropdown)
  |
  v
selectedPipelineId (state)
  |
  v
useCRMOriginsByPipeline(selectedPipelineId)
  |
  v
Filtra meetings/closerMetrics por origin_ids da pipeline
  |
  v
KPI Cards + SDR Table + Closer Table (dados filtrados)
```

### Arquivos modificados
- `src/pages/bu-consorcio/PainelEquipe.tsx` -- adicionar seletor, estado e logica de filtragem

