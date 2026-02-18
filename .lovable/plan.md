

# Mover e Excluir Lead do Pipeline

## Contexto

Atualmente o drawer do lead (QuickActionsBlock) permite mover para estágios futuros dentro da mesma pipeline, mas nao permite:
- Mover para **outra pipeline/origem** (ex: mover de "PIPE LINE - INSIDE SALES" para outra)
- **Excluir** um lead

## Solucao

Adicionar dois novos botoes no `QuickActionsBlock`:

1. **"Mover Pipeline"** -- abre um modal com select de origens disponíveis + select de estágio destino, e atualiza `origin_id` e `stage_id` do deal
2. **"Excluir"** -- abre um AlertDialog de confirmação e exclui o deal do banco

## Detalhes Técnicos

### 1. Novo componente: `src/components/crm/MoveToPipelineModal.tsx`
- Modal com dois selects:
  - Select de **Origem/Pipeline** (usa `useCRMOrigins()` para listar)
  - Select de **Estágio destino** (usa `useCRMStages(selectedOriginId)` para listar estágios da origem selecionada)
- Ao confirmar, chama `useUpdateCRMDeal` com `{ id, origin_id, stage_id }`
- Registra atividade via `useCreateDealActivity` com tipo `pipeline_change`

### 2. Hook de exclusao: adicionar `useDeleteCRMDeal` em `src/hooks/useCRMData.ts`
- Mutation que faz `supabase.from('crm_deals').delete().eq('id', dealId)`
- Invalida queries `['crm-deals']` ao concluir
- Toast de sucesso/erro

### 3. Atualizar `src/components/crm/QuickActionsBlock.tsx`
- Adicionar botao "Mover Pipeline" (icone `FolderInput`) que abre o `MoveToPipelineModal`
- Adicionar botao "Excluir" (icone `Trash2`) com `AlertDialog` de confirmacao
- Ao excluir com sucesso, fecha o drawer via `onStageChange`

### Fluxo do usuario

```text
Drawer do Lead
  |
  |-- [Mover Pipeline] --> Modal
  |     |-- Seleciona origem destino
  |     |-- Seleciona estagio destino
  |     |-- Confirma --> Atualiza origin_id + stage_id + registra atividade
  |
  |-- [Excluir] --> AlertDialog de confirmacao
        |-- Confirma --> Deleta deal + fecha drawer
```

