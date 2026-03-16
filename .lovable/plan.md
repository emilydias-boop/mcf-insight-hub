

## Mostrar tempo na stage e tempo no sistema no card do Kanban

### Situacao atual
O card mostra apenas `timeAgoShort` (linha 264) calculado a partir de `deal.created_at` -- tempo total no sistema. Nao mostra ha quanto tempo o lead esta na stage atual.

O campo `stage_moved_at` ja vem no deal (query usa `select('*')` na linha 418 de `useCRMData.ts`).

### Alteracoes

**`src/components/crm/DealKanbanCard.tsx`**

Na linha 2 do nome do lead (linha 395), adicionar ao lado do nome um indicador de tempo na stage:

```
Carlos Eduardo Xavier  ⏱ 3h
```

E na linha 3 (barra inferior, lado direito), manter o tempo total no sistema com label diferenciado.

Concretamente:
- Calcular `stageTimeShort` usando `getShortTimeAgo(deal.stage_moved_at)` (reutiliza a funcao ja existente na linha 254)
- Na **linha do nome** (linha 395): adicionar `stageTimeShort` com icone de relogio pequeno, cor `text-muted-foreground`, ao lado direito
- O `timeAgoShort` existente (tempo no sistema) permanece no canto inferior direito como esta

Layout do card ficara:

```text
[LIVE] [Mar/26] [0]                    <- badges
Carlos Eduardo Xavier        ⏱ 27m     <- nome + tempo na stage
[MS] [📞] [💬] [✉]   R$- 📞0/5 27m   <- acoes + valor + tempo sistema
```

O tooltip do relogio na stage dira "Ha X na stage atual". O tempo no canto inferior continua sendo tempo total no sistema.

