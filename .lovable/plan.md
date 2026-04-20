

## Funil completo da BU Incorporador (669 → 8)

### O que você quer ver

Um funil end-to-end onde o topo = **669 oportunidades únicas** (universo da BU) e cada etapa subsequente mostra quantos avançaram, com a soma vertical fazendo sentido em cada nível:

```
Universo BU Incorporador          669
├─ Qualificados                   168
├─ Sem Interesse                  192
├─ Agendados (R1)                 163
│  ├─ R1 Realizada                112
│  ├─ No-Show R1                   51
├─ Contrato Pago                   29
├─ R2 Realizada                    21
└─ Vendas Finais                    8
```

### Diagnóstico do que existe hoje

A página `/crm/movimentacoes` mostra apenas estágios da pipeline atual (Novo Lead, Anamnese Incompleta, etc.) — não combina dados de **agenda R1/R2** + **transações Hubla** + **estágios CRM** num funil único.

Os dados existem, mas em hooks separados:
- **669 / Qualificados / Sem Interesse / Anamnese**: `useStageMovements` (CRM stages)
- **Agendados / R1 Realizada / No-Show R1**: `useTeamMeetingsData` + `useInvestigationByPeriod` (meeting_slot_attendees, type=r1)
- **R2 Realizada / Contrato Pago**: `useR2MetricsData` + `useCloserR2Metrics` (meeting_slot_attendees type=r2 + r2_status_options)
- **Vendas Finais**: `hubla_transactions` (sale_status=completed, product_category=parceria)

Falta uma camada que **una tudo** num único funil deduplicado por contato (`contact_id`).

### Proposta: novo componente `BUFunnelComplete`

**1. Novo hook `src/hooks/useBUFunnelComplete.ts`** (~150 linhas)

Recebe: `{ bu: 'incorporador' | 'consorcio', startDate, endDate, originIds, tagFilters }`

Retorna:
```ts
interface BUFunnelData {
  universo: number;              // 669 — leads únicos por contact_id
  qualificados: number;          // 168 — leads em estágios "qualificado*"
  semInteresse: number;          // 192 — leads em estágios "sem interesse*" / "perdido*"
  agendadosR1: number;           // 163 — meeting_slot_attendees type=r1 com slot no período
  r1Realizada: number;           // 112 — status=realizada/completed
  noShowR1: number;              // 51 — status=no_show
  contratoPago: number;          // 29 — status=contract_paid OU stage "contrato pago"
  r2Realizada: number;           // 21 — meeting_slot_attendees type=r2 status=realizada
  vendasFinais: number;          // 8 — hubla_transactions completed product_category=parceria
  // listas de leads em cada etapa para drill-down
  leadsPorEtapa: Record<EtapaKey, Array<{ dealId: string; contactId: string; name: string }>>;
}
```

Dedupe sempre por `contact_id ?? deal.id` (mesma regra já corrigida em `useStageMovements`).

Reusa hooks existentes (não duplica queries):
- `useStageMovements` para universo + estágios CRM
- `useTeamMeetingsData` para R1
- `useR2MetricsData` para R2
- Query nova só para `hubla_transactions` (vendas finais)

**2. Novo componente `src/components/crm/BUFunnelComplete.tsx`** (~120 linhas)

Funil visual horizontal/vertical com:
- Cada etapa = card com (label, valor absoluto, % do topo, % da etapa anterior)
- Cores semânticas: positivo (verde) para avanço, destrutivo (vermelho) para perdas (no-show, sem interesse)
- Click numa etapa abre drawer/tabela com a lista de leads daquela etapa
- Tooltips explicando a regra de cada métrica (de onde sai o número)

**3. Nova página/aba `src/pages/crm/FunilCompleto.tsx`** (~80 linhas)

Ou adicionar como **nova seção** no topo de `/crm/movimentacoes` (acima do "Resumo por estágio"), reaproveitando os filtros de período/pipeline/tags já existentes.

Recomendação: nova seção colapsável no topo da página atual — evita duplicar filtros e dá contexto único.

### Mapeamento de cada métrica para a fonte

| Etapa | Fonte | Regra |
|---|---|---|
| Universo (669) | `crm_deals` filtrados | `count(distinct contact_id)` no escopo BU + filtros |
| Qualificados (168) | `crm_deals.stage_id` | stage name match `qualificado` |
| Sem Interesse (192) | `crm_deals.stage_id` | stage name match `sem interesse\|perdido\|desqualificado` |
| Agendados R1 (163) | `meeting_slot_attendees` | type=r1, slot no período, deduplicado por contact |
| R1 Realizada (112) | `meeting_slot_attendees` | type=r1, status `realizada\|completed` |
| No-Show R1 (51) | `meeting_slot_attendees` | type=r1, status `no_show` |
| Contrato Pago (29) | `meeting_slot_attendees` | status=`contract_paid` (já tem `contract_paid_at`) |
| R2 Realizada (21) | `meeting_slot_attendees` | type=r2, status `realizada` |
| Vendas Finais (8) | `hubla_transactions` | `sale_status=completed`, `product_category=parceria`, no período |

### Validação numérica

Os números que você passou (168+192+163 = 523 ≠ 669) indicam que **estados são mutuamente exclusivos por momento mas o lead pode passar por vários** ao longo do tempo. O funil mostra "quantos chegaram em cada etapa", não uma partição do universo. Universo (669) > soma dos ramos, e isso é correto — alguns leads ainda estão em "Anamnese Incompleta" sem ter avançado nem para Qualificado nem para Sem Interesse.

### Antes de implementar — confirmação

Preciso confirmar 3 pontos:

1. **Localização**: nova seção no topo de `/crm/movimentacoes` (recomendado, mantém filtros únicos) **ou** rota nova `/crm/funil-completo`?
2. **Escopo do filtro**: o funil deve respeitar os filtros atuais (período + pipeline + tags) ou ser sempre BU inteira (Incorporador) sem filtro de tag/pipeline?
3. **"Qualificados" e "Sem Interesse"**: quais nomes exatos de estágio devo considerar? Vejo que existem múltiplos estágios na pipeline — preciso da lista (ex.: "Lead Qualificado", "Qualificado A010", "Sem Interesse", "Não Tem Interesse", "Perdido")?

### Escopo

- 1 hook novo (`useBUFunnelComplete.ts`)
- 1 componente novo (`BUFunnelComplete.tsx`)
- 1 ajuste em `MovimentacoesEstagio.tsx` para incluir o card
- ~350 linhas no total
- Zero migration, reusa queries existentes

