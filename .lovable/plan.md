

## Plano: Corrigir filtro de pipeline para incluir todas as origens da BU Incorporador

### Problema atual
O filtro `ilike('%inside%')` captura apenas 55 leads da "PIPELINE INSIDE SALES", mas exclui 4 leads legítimos do "PILOTO ANAMNESE / INDICAÇÃO" que pertencem à mesma BU (incorporador).

**Dados da safra:**
- 55 → PIPELINE INSIDE SALES (incluídos)
- 4 → PILOTO ANAMNESE / INDICAÇÃO (excluídos incorretamente — pertencem à BU incorporador)
- 1 → Efeito Alavanca + Clube (excluído corretamente — não pertence à BU incorporador)
- Total correto: **59 contratos** (incluindo 3 reembolsos)

**Sobre João Francisco Pereira de Souza:** Ele é um caso "outside" — comprou via Hubla ("Contrato CLS - TT Caução 497") em 10/04 mas **não tem registro de R1** no sistema. Ele não aparece e não deveria aparecer no relatório de lifecycle. A recorrência dele seria tratada em outro fluxo.

### Correção em `src/hooks/useContractLifecycleReport.ts`

Substituir a query `crm_origins.ilike('name', '%inside%')` pela tabela `bu_origin_mapping` para a BU `incorporador`, que é o padrão usado no restante do projeto.

**~4 linhas alteradas:**

```ts
// ANTES (incorreto - pega só origins com "inside" no nome):
const { data: insideOrigins } = await supabase
  .from('crm_origins')
  .select('id')
  .ilike('name', '%inside%');
const insideOriginIds = new Set((insideOrigins || []).map((o: any) => o.id));

// DEPOIS (correto - pega todas as origins mapeadas à BU incorporador):
const { data: buMappings } = await supabase
  .from('bu_origin_mapping')
  .select('entity_type, entity_id')
  .eq('bu', 'incorporador');

// Resolve origin IDs: direct origins + origins filhas de grupos
const directOriginIds = (buMappings || [])
  .filter((m: any) => m.entity_type === 'origin')
  .map((m: any) => m.entity_id);
const groupIds = (buMappings || [])
  .filter((m: any) => m.entity_type === 'group')
  .map((m: any) => m.entity_id);

let allOriginIds = [...directOriginIds];
if (groupIds.length > 0) {
  const { data: childOrigins } = await supabase
    .from('crm_origins')
    .select('id')
    .in('group_id', groupIds);
  allOriginIds.push(...(childOrigins || []).map((o: any) => o.id));
}
const incorporadorOriginIds = new Set(allOriginIds);
```

E no filtro client-side, trocar `insideOriginIds` por `incorporadorOriginIds`.

Isso trará o total para **59** (55 Inside Sales + 4 Anamnese), excluindo corretamente o lead de Efeito Alavanca.

### Seção técnica
- Arquivo: `src/hooks/useContractLifecycleReport.ts`, linhas ~155-166
- Padrão já usado em: `useBUPipelineMap.ts`, `useBUOriginIds`
- A expansão de grupos garante que origins filhas de grupos mapeados também sejam incluídas

