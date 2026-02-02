
# CONCLUÍDO ✅

Objetivo: fazer o Kanban de Negócios carregar corretamente as etapas (stages) para a origem **"Efeito Alavanca + Clube"** (id `7d7b1cb5-2a44-4552-9eff-c3b798646b78`) e demais origens que usam `local_pipeline_stages`.

## Solução implementada

### 1) `src/hooks/useCRMData.ts`
- Evoluiu `useCRMStages` para aceitar `options: { enabled?, staleTime? }`
- Extraiu lógica de fetch para função reutilizável `fetchCRMStages`
- Mantém `queryKey: ['crm-stages', originOrGroupId]` como fonte de verdade única

### 2) `src/components/crm/DealFormDialog.tsx`
- Removeu a `useQuery` conflitante que usava a mesma queryKey mas buscava apenas `crm_stages`
- Substituiu por `useCRMStages(defaultOriginId, { enabled: open && !!defaultOriginId })`
- Adicionou fallback para global stages com queryKey separada `['deal-form-global-stages']`
- O dialog agora só busca stages quando está aberto

## Resultado
- O Kanban usa `useCRMStages` sem interferência do modal
- O request vai para `local_pipeline_stages` primeiro (13 etapas para 7d7b...)
- Nenhum conflito de cache entre componentes
