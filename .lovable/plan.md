

## Separar Movimentações por Pipeline no Timeline

### Problema

O timeline unificado mistura movimentações de stage de **todas as pipelines** sem distinção. Quando o lead tem deals em "Efeito Alavanca + Clube" e "Inside Sales", as mudanças de stage aparecem como se fossem na mesma pipeline, gerando confusão.

### Solução

Adicionar o **nome da pipeline** a cada evento de `stage_change` e agrupar visualmente os eventos por pipeline no timeline. Cada stage_change mostrará uma badge indicando de qual pipeline é.

### Arquivos afetados

**1. `src/hooks/useLeadFullTimeline.ts`**
- Na query de `crm_deals` (linha 89), incluir join com `crm_origins`: `select('id, created_at, origin_id, owner_id, crm_origins(name, display_name)')`
- Construir mapa `dealIdToOriginName` a partir dos deals
- Nas activities de `stage_change` (linha 173), o `deal_id` já está disponível em `act.deal_id` — usar para enriquecer o metadata com `pipeline_name`
- Também enriquecer os eventos de `entry` (linha 349) que já têm `deal.origin_id`

**2. `src/components/crm/LeadFullTimeline.tsx`**
- No `TimelineMetadata` para `stage_change`, renderizar badge com `meta.pipeline_name` quando disponível
- Adicionar badge também nos eventos de `entry`

**3. `src/components/crm/DealHistory.tsx`**
- Quando `activity.metadata?.pipeline_name` existir, exibir badge ao lado das badges de from/to stage

### Detalhe técnico

```text
// No hook, ao processar stage_change:
const pipelineName = dealIdToOriginMap[act.deal_id];
metadata: { from_stage, to_stage, pipeline_name: pipelineName }

// Na UI, badge extra:
[Efeito Alavanca + Clube] Lead Gratuito → Base
[Inside Sales]            Novo → Qualificado
```

