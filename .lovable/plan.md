

# Mover Leads em Massa para outra Pipeline

## O que será feito

Adicionar um botão **"Mover Pipeline"** na barra de ações em massa (BulkActionsBar) que permite mover todos os leads selecionados para outra pipeline (origin) e estágio, similar ao "Mover Estágio" mas cross-pipeline.

## Mudanças

| Arquivo | Alteração |
|---|---|
| `src/components/crm/BulkActionsBar.tsx` | Adicionar props `onMovePipeline` e `isMovingPipeline`, renderizar botão "Mover Pipeline" |
| `src/components/crm/BulkMovePipelineDialog.tsx` | **Novo** -- Dialog para selecionar pipeline e estágio destino, executa update em massa |
| `src/pages/crm/Negocios.tsx` | Adicionar state para o dialog, conectar ao BulkActionsBar e renderizar o novo componente |

### BulkMovePipelineDialog (novo)

Reutiliza a mesma lógica do `MoveToPipelineModal` (que move 1 deal), mas adaptado para massa:
- Select de pipeline destino (usando `useCRMOrigins` com flatMap para árvore)
- Select de estágio destino (usando `useCRMStages`)
- Ao confirmar: `supabase.from('crm_deals').update({ origin_id, stage_id }).in('id', selectedDealIds)`
- Mostra contagem: "Mover X lead(s) para nova pipeline"
- Invalida queries `crm-deals` após sucesso

### BulkActionsBar

Adicionar entre "Mover Estágio" e "Duplicar p/ Inside":
```typescript
// Novas props:
onMovePipeline?: () => void;
isMovingPipeline?: boolean;

// Botão com ícone GitBranchPlus ou FolderOutput
"Mover Pipeline"
```

### Negocios.tsx

```typescript
const [movePipelineDialogOpen, setMovePipelineDialogOpen] = useState(false);

// No BulkActionsBar:
onMovePipeline={() => setMovePipelineDialogOpen(true)}

// Renderizar:
<BulkMovePipelineDialog
  open={movePipelineDialogOpen}
  onOpenChange={setMovePipelineDialogOpen}
  selectedDealIds={Array.from(selectedDealIds)}
  onSuccess={handleClearSelection}
/>
```

