

# Filtrar Kanban do SDR por permissoes de movimentacao

## Problema
O SDR ve todas as stages no Kanban, incluindo R1 Realizada, Contrato Pago, R2 -- stages que nao sao sua responsabilidade. O filtro atual usa `canViewStage` (que retorna `true` quando nao ha permissao explicita), mas o pedido e filtrar por `can_move_to OR can_move_from`.

## Alteracao

### `src/components/crm/DealKanbanBoardInfinite.tsx`
Alterar o `useMemo` de `visibleStages` (linhas 72-76) para, quando o role do usuario for `sdr`, filtrar stages onde `canMoveFromStage(s.id) || canMoveToStage(s.id)` em vez de apenas `canViewStage(s.id)`.

```
const { role } = useAuth();  // ja importado

const visibleStages = useMemo(() => {
  const activeStages = (stages || []).filter((s: any) => s.is_active);
  
  if (role === 'sdr') {
    // SDR so ve stages onde pode movimentar deals
    return activeStages.filter((s: any) => 
      canMoveFromStage(s.id) || canMoveToStage(s.id)
    );
  }
  
  return activeStages.filter((s: any) => canViewStage(s.id));
}, [stages, canViewStage, canMoveFromStage, canMoveToStage, role]);
```

Isso ja usa `useStagePermissions` (importado) e `useAuth` (ja importado). O hook `findPermission` faz lookup por UUID e fallback por nome normalizado, cobrindo ambos os cenarios de mapeamento.

## Impacto
- Apenas 1 arquivo alterado
- Nenhuma mudanca no banco
- Outros roles nao sao afetados (continuam usando `canViewStage`)

