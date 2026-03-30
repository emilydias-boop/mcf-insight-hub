

## Botão "Mover Estágio" em massa na barra de ações

### O que será feito
Adicionar um botão **"Mover Estágio"** na `BulkActionsBar` que permite mover todos os leads selecionados para um estágio destino dentro da mesma pipeline, de uma só vez.

> O drag-and-drop individual entre estágios já funciona. Este botão resolve o caso de mover **múltiplos leads** de uma vez, sem precisar arrastar um por um.

### Implementação

#### 1. Novo componente: `BulkMoveStageDialog.tsx`
- Modal simples com um **Select de estágio destino** (usa `useCRMStages(originId)` para listar os estágios da pipeline atual)
- Ao confirmar, faz update em massa de `stage_id` para todos os deals selecionados via `supabase.from('crm_deals').update({ stage_id }).in('id', dealIds)`
- Registra atividade `stage_change` para cada deal movido
- Mostra toast de sucesso/erro e invalida queries

#### 2. Atualizar `BulkActionsBar.tsx`
- Adicionar props `onMoveStage` e `isMovingStage`
- Renderizar botão com ícone `ArrowRightLeft` e texto **"Mover Estágio"**

#### 3. Atualizar `Negocios.tsx`
- Adicionar state `moveStageDialogOpen`
- Passar `effectiveOriginId` ao dialog para carregar os estágios corretos
- Conectar o dialog passando os `selectedDealIds`
- Limpar seleção após sucesso

### Arquivos
1. `src/components/crm/BulkMoveStageDialog.tsx` — **novo**
2. `src/components/crm/BulkActionsBar.tsx` — adicionar botão
3. `src/pages/crm/Negocios.tsx` — integrar dialog

