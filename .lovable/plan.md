

## Problema: Visão Geral puxa dados de TODAS as pipelines (incluindo desativadas)

### Diagnóstico

O hook `useCRMOverviewData` tem vários pontos sem filtro de BU:

| Query | Problema |
|---|---|
| `deal_activities` (linha 136-141) | **Zero filtro** — busca TODAS as atividades do sistema inteiro |
| `get_sdr_metrics_from_agenda` RPC (linha 144-148) | `bu_filter` passado como `null` |
| Closer R1/R2 (linhas 151-172) | **Sem filtro de BU** — traz closers de todas as BUs |
| SDR ranking | Mostra SDRs de todas as pipelines porque herda atividades sem filtro |

Resultado: SDRs de outras pipelines (Consórcio, Crédito, etc.) e closers de outras BUs aparecem misturados. Leads de pipelines desativadas também entram nos números.

Além disso, `useBUOriginIds` busca todas as `crm_origins` dos grupos sem filtrar `is_archived = true`.

### Correção

**Arquivo: `src/hooks/useCRMOverviewData.ts`**

1. **`deal_activities`** — Primeiro buscar os deal_ids da BU (já faz com `allDeals`), depois filtrar as atividades. Como o Supabase não suporta subquery IN com 5000 IDs, manter a busca ampla mas garantir o filtro client-side. Porém, otimizar buscando atividades apenas dos deals já carregados usando múltiplos batches de `.in('deal_id', chunk)`.

2. **RPC `get_sdr_metrics_from_agenda`** — Passar `bu_filter` com o valor da BU ativa (ex: `'incorporador'`). O hook precisa receber o nome da BU como parâmetro.

3. **Closer R1/R2** — Filtrar por BU adicionando `.eq('meeting_slots.closers.bu', buName)` ou filtrando client-side pelo campo `bu` dos closers.

4. **SDR ranking** — Já filtra por `buDealIds` mas o RPC de agenda não filtra. Corrigir passando `bu_filter`.

**Arquivo: `src/hooks/useBUPipelineMap.ts`**

5. Na query de `crm_origins` filhas dos grupos, adicionar filtro `.not('is_archived', 'eq', true)` para excluir origens desativadas.

**Arquivo: `src/components/crm/FunilDashboard.tsx`**

6. Passar o nome da BU ativa para `useCRMOverviewData` para que ele possa filtrar RPC e closers.

### Detalhes técnicos

```text
// useCRMOverviewData signature change:
useCRMOverviewData(periodStart, periodEnd, originIds, buName)

// RPC fix:
supabase.rpc('get_sdr_metrics_from_agenda', {
  start_date: ...,
  end_date: ...,
  sdr_email_filter: null,
  bu_filter: buName || null  // was: null
})

// Closer R1/R2 fix — filter client-side:
const closerR1Filtered = (closerR1Result.data || [])
  .filter(att => att.meeting_slots?.closers?.bu === buName);

// useBUOriginIds fix:
.from('crm_origins').select('id')
  .in('group_id', buMapping.groups)
  .not('is_archived', 'eq', true)  // ADD THIS
```

### Arquivos afetados
1. **`src/hooks/useCRMOverviewData.ts`** — Adicionar param `buName`, filtrar RPC e closers por BU
2. **`src/hooks/useBUPipelineMap.ts`** — Filtrar origens arquivadas no `useBUOriginIds`
3. **`src/components/crm/FunilDashboard.tsx`** — Passar BU name para o hook

