
## Diagnóstico (por que “não abre as stages” mesmo existindo stages)
Pelo seu print, o Kanban fica em branco (sem colunas e sem a mensagem “Nenhum estágio configurado”). Isso normalmente acontece quando:

1) **As stages existem e estão vindo do banco**, mas  
2) **todas são filtradas por permissão**, então `visibleStages` fica vazio e o board renderiza “nada”.

No código, o `DealKanbanBoard` faz:
- Busca stages via `useCRMStages(originId)`
- Depois filtra com `canViewStage(stage.id)` (tabela `stage_permissions`)  
Se `canViewStage` retornar `false` para todas, o board fica vazio.

Hoje o `useStagePermissions` só sabe mapear permissões quando consegue transformar um **UUID de stage** em um **identificador normalizado** (`novo_lead`, `lead_qualificado`, etc.).  
Ele faz isso olhando apenas `crm_stages` (`stagesMap` = `crm_stages.id -> stage_name`).  
Mas o pipeline criado pelo Wizard usa **local_pipeline_stages**, então:
- `stage.id` é UUID de `local_pipeline_stages`
- `useStagePermissions` não conhece esse UUID → não consegue normalizar → `canViewStage` volta `false`.

## Objetivo da correção
1) Fazer `useStagePermissions` reconhecer também stages do `local_pipeline_stages` (id → name).  
2) Assim, `canViewStage(stage.uuid)` consegue converter para `novo_lead`, `r2_agendada`, etc., e bater com `stage_permissions.stage_id`.

## Implementação (mudanças de código)
### 1) Atualizar `useStagePermissions.ts` para mapear também `local_pipeline_stages`
Arquivo: `src/hooks/useStagePermissions.ts`

Mudança:
- No query `stagesMap`, em vez de buscar só:
  - `crm_stages.select('id, stage_name')`
- Buscar também:
  - `local_pipeline_stages.select('id, name')`
- E construir um único mapa `{[uuid]: stageName}` unindo as duas fontes.

Pseudo:
- `crmStagesMap[id] = stage_name`
- `localStagesMap[id] = name`
- `return { ...crmStagesMap, ...localStagesMap }`

### 2) Melhorar UX quando “stages existem mas nenhuma é visível”
Arquivo: `src/components/crm/DealKanbanBoard.tsx`

Hoje só existe “empty state” quando `stages.length === 0`.

Vamos adicionar um segundo estado:
- Se `stages.length > 0` **e** `visibleStages.length === 0`, mostrar uma mensagem clara:
  - “Você não tem permissão para visualizar as etapas deste pipeline (stage_permissions).”
  - E sugerir onde ajustar (Configurações / Permissões de etapa).

Isso evita a tela “vazia e misteriosa”.

## Validação (como vamos conferir)
1) Recarregar `/crm/negocios` no pipeline “Lançamento / Live”.
2) Confirmar que:
   - As colunas aparecem (“Novo Lead”, “Lead Qualificado”, “R2 Agendada”, etc.)
3) Se ainda não aparecer:
   - Verificar no Network se a chamada `local_pipeline_stages?origin_id=...` retorna stages (já vimos que retorna)
   - Verificar se `stage_permissions` existe para o role atual (no Test existe), então o problema seria só mapeamento mesmo.

## Riscos / cuidados
- `local_pipeline_stages.name` tem capitalização (“Novo Lead”). A normalização já converte para minúsculo e troca espaços, então deve casar com `stage_permissions.stage_id`.
- Não vamos mudar banco nem RLS; é ajuste puramente de frontend/queries.

## Arquivos que serão alterados
- `src/hooks/useStagePermissions.ts`
- `src/components/crm/DealKanbanBoard.tsx`

## Critério de pronto (DoD)
- Kanban do “Lançamento / Live” renderiza colunas.
- Se alguma role realmente não tiver acesso, aparece mensagem explícita (em vez de tela vazia).
