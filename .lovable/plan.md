## Problema
SDRs de Consórcio (Cleiton Lima e Ithaline Clara) não conseguem ver os leads no CRM Consórcio (Kanban / Novo Lead (Form) e demais estágios).

## Causa raiz
A tabela `pipeline_permissions` tem apenas uma linha para `role='sdr'` liberando somente o grupo **"Perpétuo - X1"**. O hook `usePipelinePermissions.hasPermissionRestrictions()` considera "há permissão configurada → restringir tudo o que não estiver explicitamente permitido". Como não há linha liberando o grupo BU Consórcio (`f8a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c`) nem suas origens (**Efeito Alavanca + Clube** e **Cobrança Consorcio**), os SDRs do squad Consórcio veem o Kanban vazio.

Além disso, os registros dos dois SDRs na tabela `sdr` estão com `allowed_origin_ids = NULL`, então não há override individual que compense.

## Correção (apenas dados, sem código)

1. **Adicionar permissões de pipeline para `role='sdr'`** cobrindo o grupo BU Consórcio e suas duas origens, com `can_view=true` e `can_edit=true`:
   - group_id = `f8a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c`
   - origin_id = `7d7b1cb5-2a44-4552-9eff-c3b798646b78` (Efeito Alavanca + Clube)
   - origin_id = `ea7aac02-3a69-422a-9f6e-691c8a04f06a` (Cobrança Consorcio)

   Assim qualquer SDR do squad Consórcio (atual e futuro) passa a enxergar o Kanban.

2. **Preencher `allowed_origin_ids`** para Cleiton e Ithaline como reforço (mesmo padrão dos demais SDRs de Consórcio) — as duas origens acima.

## Validação
- Confirmar via query que as duas linhas passam a existir e que os SDRs veem os 228 negócios em **NOVO LEAD ( FORM )** + demais estágios ao abrir o Kanban Consórcio.
- Não altera visibilidade dos SDRs de Incorporador (grupo/origens diferentes, sem sobreposição).

## Fora de escopo
- Refatorar `usePipelinePermissions` para tratar o vazio de forma diferente.
- Ajustes de UI ou lógica em `BUCRMLayout`.
