

# Permitir busca de leads "Contrato Pago" no agendamento R2

## Problema

Closers de R1 não conseguem encontrar leads no modal "Agendar Reunião R2" porque o hook `useSearchDealsForSchedule` filtra deals com status "won" (incluindo "Contrato Pago"). Isso impede o agendamento de R2 para leads que já pagaram contrato na R1.

## Causa raiz

Em `src/hooks/useAgendaData.ts` (linha 942-947), a busca exclui todos os deals cujo estágio é classificado como "won" por `getDealStatusFromStage`. Como "Contrato Pago" está na lista de `WON_KEYWORDS`, esses leads nunca aparecem nos resultados.

## Solução

Modificar `useSearchDealsForSchedule` para aceitar um parâmetro opcional `includeWon` que, quando `true`, inclui deals com status "won" nos resultados. O modal R2 passará `includeWon: true`.

| Arquivo | Alteração |
|---|---|
| `src/hooks/useAgendaData.ts` | Adicionar parâmetro `includeWon?: boolean` ao hook. Na linha 943, mudar filtro para: `status === 'open' \|\| (includeWon && status === 'won')` |
| `src/components/crm/R2QuickScheduleModal.tsx` | Passar `includeWon: true` na chamada: `useSearchDealsForSchedule(searchQuery, undefined, undefined, true)` |

### Detalhe da alteração principal

```typescript
// useAgendaData.ts - assinatura
export function useSearchDealsForSchedule(
  query: string, originIds?: string[], ownerEmail?: string, includeWon?: boolean
)

// Filtro (linha 943)
const openDeals = normalizedDeals.filter(deal => {
  const stageName = deal.stage?.stage_name;
  const status = getDealStatusFromStage(stageName);
  return status === 'open' || (includeWon && status === 'won');
});
```

Isso mantém o comportamento atual do R1 (que não precisa ver deals ganhos) e libera a busca de "Contrato Pago" apenas no contexto R2.

