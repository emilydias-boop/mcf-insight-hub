

# Corrigir Atribuicao de Leads no Limbo: Incluir Mudanca de Stage

## Problema
Atualmente, ao atribuir leads no Leads em Limbo, o sistema apenas atualiza o `owner_id` e `owner_profile_id`. Porem, os leads precisam tambem ser movidos para a stage correta (ex: "Novo Lead") para ficarem visiveis no Kanban do SDR que recebeu.

## Solucao
Alterar a mutation `useAssignLimboOwner` para tambem atualizar o `stage_id` do deal para "Novo Lead" da pipeline correspondente ao atribuir.

## Implementacao

### Arquivo: `src/hooks/useLimboLeads.ts`

Modificar a funcao `useAssignLimboOwner` para:

1. Receber um parametro opcional `stageId` (stage de destino)
2. Se nao fornecido, usar o stage "Novo Lead" da Pipeline Inside Sales como padrao (`cf4a369c-c4a6-4299-933d-5ae3dcc39d4b`)
3. Incluir `stage_id` no update junto com `owner_id` e `owner_profile_id`
4. Registrar atividade de `stage_change` alem da mudanca de owner

```typescript
// Mutation atualizada
mutationFn: async ({ dealIds, ownerEmail, ownerProfileId, stageId }: {
  dealIds: string[];
  ownerEmail: string;
  ownerProfileId: string;
  stageId?: string;
}) => {
  const NOVO_LEAD_STAGE = 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b';
  const targetStage = stageId || NOVO_LEAD_STAGE;
  const batchSize = 50;

  for (let i = 0; i < dealIds.length; i += batchSize) {
    const batch = dealIds.slice(i, i + batchSize);
    const { error } = await supabase
      .from('crm_deals')
      .update({
        owner_id: ownerEmail,
        owner_profile_id: ownerProfileId,
        stage_id: targetStage,
      })
      .in('id', batch);
    if (error) throw error;
  }
  return { count: dealIds.length };
}
```

### Arquivo: `src/pages/crm/LeadsLimbo.tsx`

Nenhuma alteracao necessaria na chamada, pois o `stageId` e opcional e o padrao ja sera "Novo Lead". Porem, sera adicionado um texto informativo no botao/barra indicando que os leads serao movidos para "Novo Lead".

## Resumo das mudancas
- **`src/hooks/useLimboLeads.ts`**: Adicionar `stage_id` ao update da mutation, com valor padrao "Novo Lead" da Pipeline Inside Sales
- **`src/pages/crm/LeadsLimbo.tsx`**: Adicionar indicacao visual de que leads serao movidos para "Novo Lead" ao atribuir
