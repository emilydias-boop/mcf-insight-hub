
Objetivo: destravar a movimentação do SDR Ygor para “SEM RETORNO” no Consórcio e eliminar esse tipo de erro de FK de forma definitiva.

Resumo do diagnóstico (confirmado):
- O erro exibido no print é: `insert or update on table "crm_deals" violates foreign key constraint "crm_deals_stage_id_fkey"`.
- A coluna `crm_deals.stage_id` aceita apenas IDs que existam em `crm_stages`.
- No pipeline **Efeito Alavanca + Clube**:
  - a stage **SEM RETORNO** existe em `local_pipeline_stages` com id `02642d65-547b-498c-9c45-20e5697dfa6f`;
  - essa mesma stage **não existe** em `crm_stages` (por isso quebra ao salvar).
- Não é bloqueio de permissão do SDR (role/permissions); é inconsistência de dados entre as duas tabelas de stages.
- Há mais inconsistências do mesmo tipo no projeto (não é caso isolado), então precisamos corrigir o dado e blindar o fluxo.

Plano de implementação

1) Correção imediata de dados (destravar Ygor agora)
- Executar backfill para espelhar todas as stages ativas ausentes:
  - origem dos dados: `local_pipeline_stages`;
  - destino: `crm_stages` (mesmo `id`).
- Regra de espelhamento:
  - `id = local.id`
  - `stage_name = local.name`
  - `color = local.color`
  - `stage_order = local.stage_order`
  - `stage_type = local.stage_type`
  - `origin_id = local.origin_id`
  - `clint_id = 'local-' || local.id`
  - `is_active = true`
- Isso inclui a `SEM RETORNO` do funil do Ygor e os demais gaps já existentes.

2) Blindagem no backend para não voltar a quebrar
- Criar edge function nova (service role), por exemplo:
  - `supabase/functions/ensure-crm-stage-mirror/index.ts`
- Responsabilidade:
  - receber `stage_id`;
  - validar autenticação e perfil permitido;
  - buscar a stage em `local_pipeline_stages`;
  - fazer upsert idempotente em `crm_stages` para garantir FK válida.
- Benefício: se algum pipeline ficar dessincronizado no futuro, o sistema se auto-recupera.

3) Retry automático na atualização de negócio
- Arquivo: `src/hooks/useCRMData.ts` (`useUpdateCRMDeal`)
- Fluxo novo no mutation de update:
  - tenta atualizar o deal normalmente;
  - se falhar com `crm_deals_stage_id_fkey` e houver `stage_id` no payload:
    - chama `ensure-crm-stage-mirror` com esse `stage_id`;
    - reexecuta o update uma única vez.
- Mensagem ao usuário:
  - se recuperar: sucesso normal;
  - se falhar de novo: erro claro (“estágio inválido ou não sincronizado”).

4) Endurecimento dos pontos de criação/edição de pipeline
- Arquivos:
  - `src/components/crm/PipelineStagesEditor.tsx`
  - `src/hooks/useCreatePipeline.ts`
- Ajuste:
  - hoje o espelhamento para `crm_stages` é “não-fatal” (apenas warning).
  - vamos tornar esse trecho confiável (ou via função backend única), para evitar que stage exista só em `local_pipeline_stages`.

Validação (aceite)
- Testar com usuário SDR Ygor no `/consorcio/crm/negocios`:
  1. mover card por drag-and-drop para **SEM RETORNO**;
  2. mover via Drawer (QuickActions “Mover para…” → **SEM RETORNO**);
  3. confirmar ausência do toast de FK.
- Conferências de dados:
  - `crm_deals.stage_id` atualizado para a stage alvo;
  - `crm_stages` contém a linha da `SEM RETORNO` com mesmo id da local.
- Regressão:
  - repetir em outro funil que estava com stage faltante para garantir robustez.

Riscos e mitigação
- Risco: função backend permissiva demais.
  - Mitigação: validar usuário autenticado e limitar escopo da função ao `stage_id` solicitado.
- Risco: retries infinitos.
  - Mitigação: apenas 1 retry após sincronização.
- Risco: divergência futura entre tabelas.
  - Mitigação: endurecer criação/edição de stages para sempre espelhar corretamente.

Ordem de execução recomendada
1. Backfill de dados (resolve produção imediatamente).
2. Edge function de garantia de espelhamento.
3. Retry automático no `useUpdateCRMDeal`.
4. Hardening no editor/wizard de pipeline.
5. Testes E2E com Ygor e validação final.
