

# Fix: SDRs do Consorcio nao conseguem arrastar para Sem Interesse / Sem Retorno

## Problema

Os componentes `DealKanbanBoard.tsx` e `DealKanbanBoardInfinite.tsx` possuem um filtro hardcoded que esconde colunas "lost" (como "SEM INTERESSE") para SDRs:

```
if (role === 'sdr' && !showLostDeals) {
  return filteredByPermission.filter((s: any) => !isLostStage(s.stage_name));
}
```

Esse filtro usa pattern matching em nomes como "sem interesse", "nao quer", "perdido", etc. No Consorcio, o estagio "NAO QUER - SEM INTERESSE" e capturado por esse filtro e escondido, mesmo que a tabela `stage_permissions` permita SDRs visualizar e mover para esse estagio.

A `stage_permissions` ja e a fonte de verdade para permissoes. O filtro `isLostStage` e uma camada redundante e conflitante que deve ser removida.

## Solucao

Remover o filtro hardcoded `isLostStage` para SDRs em ambos os componentes Kanban. A visibilidade dos estagios deve ser controlada exclusivamente pela tabela `stage_permissions` (via `canViewStage`), que ja esta sendo aplicada na linha anterior do mesmo `useMemo`.

## Alteracoes

| Arquivo | Linhas | Mudanca |
|---------|--------|---------|
| `src/components/crm/DealKanbanBoard.tsx` | ~85-97 | Remover bloco `if (role === 'sdr' && !showLostDeals)` que filtra `isLostStage` |
| `src/components/crm/DealKanbanBoardInfinite.tsx` | ~74-86 | Remover bloco `if (role === 'sdr' && !showLostDeals)` que filtra `isLostStage` |

O codigo de `visibleStages` ficara assim:

```
const visibleStages = useMemo(() => {
  const activeStages = (stages || []).filter((s: any) => s.is_active);
  // stage_permissions is the sole source of truth for visibility
  return activeStages.filter((s: any) => canViewStage(s.id));
}, [stages, canViewStage]);
```

As props `showLostDeals` e a importacao de `isLostStage` podem ser removidas de ambos os componentes, pois nao serao mais usadas.

## Resultado

- SDRs do Consorcio veem e podem arrastar para "SEM INTERESSE" normalmente
- Permissoes de visibilidade controladas exclusivamente pela tabela `stage_permissions`
- Nenhum impacto no Inside Sales: se nao houver permissao explicita, `canViewStage` retorna `true` por padrao (comportamento atual)

