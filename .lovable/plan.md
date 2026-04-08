

# Adicionar botão de excluir ajuste no fechamento SDR + preservar ajustes no recálculo

## Problema

1. **Sem botão de excluir**: O histórico de ajustes no Detail.tsx mostra os ajustes mas não tem botão de remover (diferente do consórcio que já tem `useRemoveConsorcioAjuste`)
2. **Recálculo apaga ajustes**: Quando recalcula o payout, o edge function sobrescreve `valor_variavel_total` e `total_conta` sem somar os ajustes existentes

## Mudanças

| Arquivo | Alteração |
|---|---|
| `src/hooks/useSdrFechamento.ts` | Criar `useRemoveAdjustment` (seguindo padrão do `useRemoveConsorcioAjuste`) |
| `src/pages/fechamento-sdr/Detail.tsx` | Adicionar botão Trash2 ao lado de cada ajuste no histórico, importar e usar `useRemoveAdjustment` |

### 1. Hook `useRemoveAdjustment` (useSdrFechamento.ts)

Recebe `{ payoutId, index }`, busca o payout, remove o ajuste do array `ajustes_json`, e subtrai o valor do `valor_variavel_total` e `total_conta`:

```typescript
export const useRemoveAdjustment = () => {
  // Mesma lógica do useRemoveConsorcioAjuste mas para sdr_month_payout
  // - Busca payout atual
  // - Verifica se status não é 'locked'/'approved'
  // - Remove ajuste pelo índice
  // - Subtrai valor do total_conta e valor_variavel_total
  // - Registra no audit log
};
```

### 2. Botão de excluir no Detail.tsx

No mapa de ajustes (linhas 614-628), adicionar um botão `Trash2` ao lado do valor:

```tsx
<Button variant="ghost" size="icon" 
  onClick={() => removeAdjustment.mutate({ payoutId: payout.id, index: idx })}
  disabled={!canEdit}
>
  <Trash2 className="h-3.5 w-3.5 text-destructive" />
</Button>
```

O botão só aparece quando `canEdit` é true (admin/manager com payout não locked).

