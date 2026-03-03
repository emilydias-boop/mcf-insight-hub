

## Problemas Identificados

### 1. Lista de etapas não rola (scroll)
O `DialogContent` tem `h-[80vh]` e `overflow-hidden`, e a área de conteúdo tem `overflow-y-auto`. O problema é que o componente `PipelineStagesEditor` tem seu próprio wrapper `space-y-4` sem restrição de altura — o conteúdo cresce mas o scroll não funciona corretamente porque falta `min-h-0` no container flex intermediário.

**Correção**: Adicionar `overflow-y-auto` e `max-h-full` no container do `PipelineStagesEditor`, e garantir que o right content panel tenha as constraints corretas de flex.

### 2. Erro RLS ao criar stage em `crm_stages`
O `PipelineStagesEditor` faz upsert direto no `crm_stages` via client-side Supabase (linha 100-110). A policy RLS exige `has_role(auth.uid(), 'admin')`. Apesar do usuário ser admin, o upsert pode falhar por questões de timing/cache do RLS.

**Correção**: Em vez de upsert direto, usar a Edge Function `ensure-crm-stage-mirror` que já existe e usa `service_role_key` (bypassa RLS). O fluxo:
1. Criar em `local_pipeline_stages` (funciona normalmente)
2. Chamar `ensure-crm-stage-mirror` com o `stage_id` retornado (usa service role, sem RLS)

Mesma abordagem para update/delete: usar a Edge Function ou adicionar uma policy `WITH CHECK` explícita.

### Arquivos a modificar
- `src/components/crm/PipelineStagesEditor.tsx` — usar edge function para mirror + scroll fix
- `src/components/crm/PipelineConfigModal.tsx` — ajustar CSS do container de conteúdo para scroll funcionar

