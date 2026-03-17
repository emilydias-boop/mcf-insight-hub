

## Deals cross-pipeline não aparecem no Kanban ao buscar

### Problema

A busca cross-pipeline foi implementada corretamente: o deal do Ulysses é encontrado (mostra "1 oportunidade"). Porém o Kanban só renderiza colunas dos estágios da pipeline selecionada ("Pipeline de Vendas"). Como o deal do Ulysses pertence à pipeline "INSIDE SALES - VIVER DE ALUGUEL" ou "PIPELINE INSIDE SALES", seu `stage_id` não corresponde a nenhuma coluna visível, e o card simplesmente não aparece.

### Solução

Quando o usuário está em **modo busca** e existem deals de **outras pipelines** nos resultados, mostrar uma seção especial acima ou abaixo do Kanban listando esses deals "cross-pipeline" em formato de tabela/lista.

#### 1. Detectar deals cross-pipeline (`Negocios.tsx`)

Após filtrar os deals, separar em dois grupos:
- `dealsInCurrentPipeline`: deals cujo `stage_id` existe nos stages da pipeline selecionada
- `crossPipelineDeals`: deals cujo `stage_id` NÃO existe nos stages atuais

#### 2. Renderizar seção cross-pipeline (`Negocios.tsx`)

Quando `crossPipelineDeals.length > 0` e há busca ativa, mostrar um alerta/card acima do Kanban:
- Título: "Encontrados em outras pipelines"
- Lista compacta com: nome do deal, pipeline de origem (`crm_origins.name`), estágio atual, botão para abrir o drawer do deal
- Badge indicando a pipeline de origem

#### 3. Permitir abrir o Drawer direto

Ao clicar no deal cross-pipeline, abrir o `DealDrawer` normalmente (já funciona com qualquer `deal_id`).

### Arquivos a editar

| Arquivo | Ação |
|---|---|
| `src/pages/crm/Negocios.tsx` | Separar deals em current vs cross-pipeline; renderizar seção de resultados cross-pipeline acima do Kanban quando em modo busca |
| `src/components/crm/DealKanbanBoard.tsx` | Receber e expor os `stageIds` visíveis para que `Negocios.tsx` possa fazer a separação (ou buscar stages separadamente) |

Nenhum arquivo novo necessário. A lógica é simples: filtrar deals que não pertencem às colunas visíveis e mostrá-los numa lista separada.

