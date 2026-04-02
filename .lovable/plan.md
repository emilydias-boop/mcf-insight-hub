

## Saúde da Pipeline: Acompanhar o Filtro de Período

### Problema atual

O bloco "Saúde da Pipeline" mostra um snapshot de **todos os deals abertos de todos os tempos** — por isso números como 3997 parados. Ele ignora o filtro de período (Hoje/Semana/Mês).

O usuário quer saber: "dos que entraram hoje, quantos já foram trabalhados?" — uma visão contextual ao período.

### Solução

Reformular o bloco para mostrar **dois contextos**:

**Linha 1 — Fluxo do Período** (segue o filtro):
| Métrica | Cálculo |
|---|---|
| Entraram | Deals criados no período (`created_at` entre start/end) |
| Já trabalhados | Dos que entraram, quantos têm atividade no período |
| Sem toque | Dos que entraram, quantos NÃO têm nenhuma atividade ainda |
| Avançados | Dos que entraram, quantos tiveram stage_change positiva |

**Linha 2 — Saúde Geral (snapshot, mas filtrado)** — somente deals abertos que foram **criados nos últimos 90 dias** para excluir "estoque morto":
| Métrica | Cálculo |
|---|---|
| Abertos (recentes) | Deals abertos criados nos últimos 90 dias |
| Parados (3d+) | Desses, sem atividade há 3+ dias |
| Envelhecidos (7d+) | Desses, sem atividade há 7+ dias |
| Tempo médio s/ mov | Média de horas sem atividade (dos recentes) |

**Travados por Etapa** — mantém, mas usando apenas deals dos últimos 90 dias.

### Arquivos afetados

1. **`src/hooks/useCRMOverviewData.ts`**
   - Adicionar à interface `PipelineHealthData`: `entaramNoPeriodo`, `trabalhadosNoPeriodo`, `semToqueNoPeriodo`, `avancadosNoPeriodo`
   - Calcular essas 4 métricas cruzando `newDeals` (criados no período) com `buActivities`
   - Filtrar `openDeals` para últimos 90 dias antes de calcular parados/envelhecidos/SLA

2. **`src/components/crm/overview/PipelineHealthBlock.tsx`**
   - Adicionar primeira linha com métricas do período (Entraram / Já trabalhados / Sem toque / Avançados)
   - Separar visualmente com label "No período" e "Saúde geral"
   - Manter layout grid existente

### Detalhes técnicos

```text
// No hook — novos campos calculados:
const newDealIds = allDeals
  .filter(d => new Date(d.created_at) >= periodStart && new Date(d.created_at) <= periodEnd)
  .map(d => d.id);
const newDealIdSet = new Set(newDealIds);

const trabalhadosNoPeriodo = newDealIds.filter(id => workedDealIds.has(id)).length;
const semToqueNoPeriodo = newDealIds.filter(id => !workedDealIds.has(id)).length;
const avancadosNoPeriodo = stageChanges
  .filter(a => newDealIdSet.has(a.deal_id) && a.to_stage && !lossStageIds.has(a.to_stage))
  ...

// Filtro 90 dias para saúde geral:
const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
const recentOpenDeals = openDeals.filter(d => new Date(d.created_at) >= ninetyDaysAgo);
```

