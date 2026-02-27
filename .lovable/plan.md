

## Plano: Auto-ocultar sidebar quando há apenas 1 pipeline

### Lógica
Quando a BU ativa possui apenas **1 grupo** mapeado em `bu_origin_mapping`, a sidebar ocupa espaço desnecessário. A solução é:
- Contar quantos grupos a BU possui
- Se for apenas 1: ocultar sidebar, auto-selecionar esse grupo, e mover "Criar Pipeline" e configurações para o header do Kanban
- Se for >1: manter sidebar normalmente

### 1. `src/pages/crm/Negocios.tsx` — Lógica de auto-hide
- Calcular `hasSinglePipeline = buAllowedGroups.length === 1`
- Alterar `showSidebar` para incluir: `showSidebar && !hasSinglePipeline`
- Quando `hasSinglePipeline`, auto-selecionar `buAllowedGroups[0]` como `selectedPipelineId` no `useEffect` de default
- Mover botão "Criar Pipeline" para o header (ao lado de "Sincronizar" e "Novo Negócio") quando sidebar está oculta

### 2. Sem sidebar → header compacto
- Quando `hasSinglePipeline`, exibir nome da pipeline selecionada no título (ex: "Pipeline Inside Sales — 7967 oportunidades")
- Adicionar botão de configurações (⚙️) inline no header que abre `PipelineConfigModal` para a pipeline ativa

