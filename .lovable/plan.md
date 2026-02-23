
# Fix: Stages nao persistem ao excluir/reordenar no Editor de Pipeline

## Problema

Quando voce exclui ou reordena stages no editor de configuracao ("Etapas do Kanban"), as mudancas parecem nao funcionar porque:

1. **Excluir**: O editor deleta a stage de `local_pipeline_stages`, mas ela continua existindo em `crm_stages`. O hook `useCRMStages` que monta o Kanban faz um **merge** das duas tabelas, re-adicionando stages que foram deletadas localmente.

2. **Reordenar**: A ordem e atualizada em `local_pipeline_stages`, mas o merge re-adiciona stages de `crm_stages` com ordem diferente, bagunando a sequencia.

3. **"Proposta Recusada" -> "Sem Sucesso"**: Essa stage (`c2c7288b`) existe em `crm_stages` mas nao em `local_pipeline_stages`. Tem 1 deal nela. Ela aparece no Kanban por causa do merge.

### Dados atuais da pipeline "Efeito Alavanca + Clube"

- `local_pipeline_stages`: 14 stages (sem "SEM INTERESSE", sem "SEM RETORNO", sem "EVENTOS antigos")
- `crm_stages`: 16 stages (inclui "SEM INTERESSE", "SEM RETORNO", "PRODUTOS FECHADOS", "SEM SUCESSO" e "EVENTOS")

O merge adiciona stages que so existem em `crm_stages`, ignorando as exclusoes feitas pelo usuario.

## Solucao

### 1. Espelhar exclusao e reordenacao em `crm_stages`

**Arquivo:** `src/components/crm/PipelineStagesEditor.tsx`

**Delete mutation** (linhas 150-167):
- Alem de deletar de `local_pipeline_stages`, marcar como `is_active = false` em `crm_stages`
- Nao deletar de `crm_stages` porque deals podem ter FK referenciando o stage_id

**Reorder mutation** (linhas 169-192):
- Alem de atualizar `stage_order` em `local_pipeline_stages`, atualizar tambem em `crm_stages` (para os stages que tem espelho)

**Update mutation** (linhas 130-148):
- Espelhar mudanca de nome/cor/tipo em `crm_stages`

### 2. Corrigir merge em `useCRMStages` para respeitar exclusoes locais

**Arquivo:** `src/hooks/useCRMData.ts`

Na logica de merge (linhas 127-168), quando existem `local_pipeline_stages`:
- **Antes**: Adicionar stages de `crm_stages` que nao existem nos locais (por nome)
- **Depois**: So adicionar stages de `crm_stages` que tem deals vinculados E nao foram explicitamente excluidas. Se uma stage esta em `crm_stages` mas nao em `local_pipeline_stages`, e tem deals, adicionar com um indicador visual. Se nao tem deals, ignorar completamente.

A logica simplificada sera: quando existem stages locais, elas sao a unica fonte de verdade para a **visibilidade** do Kanban. Stages do `crm_stages` que nao estao no local so aparecem se tiverem deals (para o usuario poder mover esses deals).

### 3. Limpar `crm_stages` para stages deletadas

**Migration SQL**: Marcar como `is_active = false` as stages que existem em `crm_stages` mas foram removidas de `local_pipeline_stages` e nao tem deals:
- "SEM INTERESSE" (id: `91fcdb43`) - verificar se tem deals
- "SEM RETORNO" (id: `02642d65`) - nao esta em crm_stages, so no local
- "PRODUTOS FECHADOS" (id: `2357df56`) - verificar deals

## Detalhes Tecnicos

### PipelineStagesEditor.tsx - Delete Mutation

```text
// Antes: so deleta de local_pipeline_stages
// Depois: 
1. Deletar de local_pipeline_stages
2. UPDATE crm_stages SET is_active = false WHERE id = stageId
   (nao-fatal, apenas log de warning)
```

### PipelineStagesEditor.tsx - Reorder Mutation

```text
// Antes: so atualiza stage_order em local_pipeline_stages
// Depois:
1. Atualizar stage_order em local_pipeline_stages
2. Para cada stage, tentar UPDATE crm_stages SET stage_order = X WHERE id = stageId
   (nao-fatal)
```

### PipelineStagesEditor.tsx - Update Mutation

```text
// Antes: so atualiza em local_pipeline_stages
// Depois:
1. Atualizar em local_pipeline_stages  
2. UPDATE crm_stages SET stage_name = name, color = color WHERE id = stageId
   (nao-fatal)
```

### useCRMData.ts - Merge Logic

```text
// Antes (linha 153-165):
// Adicionar stages do crm_stages que NAO existem nos locais
crmStages.forEach((crmStage) => {
  if (!localNames.has(crmStage.stage_name.toLowerCase())) {
    mergedStages.push(crmStage);
  }
});

// Depois:
// Quando existem local stages, elas sao a UNICA fonte de verdade
// NAO re-adicionar stages de crm_stages
// Isso garante que excluir/reordenar no editor funcione
```

## Resultado Esperado

- Excluir uma stage no editor a remove do Kanban imediatamente
- Reordenar stages no editor reflete no Kanban
- Stages com deals vinculados que foram excluidas: os deals ficam "sem coluna visivel" ate serem movidos - o usuario precisa mover esses deals antes de excluir
- A "SEM SUCESSO" que tem 1 deal continuara visivel ate o deal ser movido

## Arquivos a Modificar

1. `src/components/crm/PipelineStagesEditor.tsx` - Espelhar delete/reorder/update em crm_stages
2. `src/hooks/useCRMData.ts` - Parar de re-adicionar stages deletadas no merge
