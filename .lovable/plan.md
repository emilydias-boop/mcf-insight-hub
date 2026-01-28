

# Corrigir Carregamento de Stages para Pipelines Criados pelo Wizard

## Problema Identificado

O pipeline "Lançamento / Live" (`39b2fa34`) foi criado pelo Wizard e tem a seguinte estrutura:

```text
Grupo: 39b2fa34 (Lançamento / Live)
  └── Origem filha: 3228de9a (Lançamento)
        └── 6 stages locais (Novo Lead, Lead Qualificado, R2 Agendada, etc.)
```

O hook `useCRMStages` quando recebe um **group_id**:
1. Detecta corretamente que é um grupo
2. Busca `local_pipeline_stages` filtrando por `group_id = 39b2fa34`
3. Mas as stages estão salvas com `origin_id = 3228de9a` (a origem filha)
4. Resultado: 0 stages encontradas

## Solução

Modificar o hook `useCRMStages` para, quando receber um grupo, buscar também as `local_pipeline_stages` das **origens filhas** desse grupo.

## Arquivo a Modificar

**`src/hooks/useCRMData.ts`** - função `useCRMStages`

## Mudanças no Código

### Lógica Atual (problemática)

```typescript
// Linha 33-43: Busca local_pipeline_stages apenas por group_id
const localStagesQuery = isGroup
  ? supabase
      .from('local_pipeline_stages')
      .select('*')
      .eq('group_id', originOrGroupId)  // <-- Problema: stages estão em origin_id
      .eq('is_active', true)
  : supabase
      .from('local_pipeline_stages')
      .select('*')
      .eq('origin_id', originOrGroupId)
      .eq('is_active', true);
```

### Lógica Corrigida

Quando for um grupo:
1. Primeiro buscar origens filhas do grupo
2. Buscar `local_pipeline_stages` onde `origin_id` está na lista de origens OU `group_id` é o grupo
3. Deduplicar por nome (caso haja stages em múltiplas origens)

```typescript
if (isGroup) {
  // Buscar origens filhas do grupo
  const { data: childOrigins } = await supabase
    .from('crm_origins')
    .select('id')
    .eq('group_id', originOrGroupId);
  
  const originIds = childOrigins?.map(o => o.id) || [];
  
  // Buscar local_pipeline_stages em qualquer origem filha OU diretamente no grupo
  let localStagesQuery = supabase
    .from('local_pipeline_stages')
    .select('*')
    .eq('is_active', true);
  
  if (originIds.length > 0) {
    // Buscar por origin_id nas origens filhas OU por group_id diretamente
    localStagesQuery = localStagesQuery.or(
      `origin_id.in.(${originIds.join(',')}),group_id.eq.${originOrGroupId}`
    );
  } else {
    localStagesQuery = localStagesQuery.eq('group_id', originOrGroupId);
  }
  
  const { data: localStages } = await localStagesQuery.order('stage_order');
  
  // Deduplicar por nome mantendo o primeiro (menor stage_order)
  if (localStages && localStages.length > 0) {
    const uniqueStages = localStages.reduce((acc, stage) => {
      if (!acc.find(s => s.name === stage.name)) {
        acc.push(stage);
      }
      return acc;
    }, []);
    
    return uniqueStages.map(s => ({
      id: s.id,
      stage_name: s.name,
      color: s.color,
      stage_order: s.stage_order,
      stage_type: s.stage_type,
      is_active: s.is_active,
      origin_id: s.origin_id || s.group_id,
      clint_id: `local-${s.id}`,
      created_at: s.created_at,
      updated_at: s.updated_at,
    }));
  }
}
```

## Resultado Esperado

Após a correção:
- Pipeline "Lançamento / Live" mostrará as 6 colunas do Kanban
- Outros pipelines criados pelo Wizard também funcionarão
- Pipelines existentes (como PIPELINE INSIDE SALES) continuarão funcionando normalmente

## Detalhes Técnicos

| Item | Valor |
|------|-------|
| Group ID | `39b2fa34-4dc2-43cb-9ce1-e7b3ffa8ab3d` |
| Origin filha | `3228de9a-610e-4b57-b031-02236bd2ed73` |
| Stages locais | 6 (Novo Lead, Lead Qualificado, R2 Agendada, R2 Realizada, Venda Realizada, Sem Interesse) |
| Tabela | `local_pipeline_stages` |

