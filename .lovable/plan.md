
# Plano: Corrigir Atualização da UI Após Envio de NFSe

## Problema Identificado

Após o envio bem-sucedido da NFSe, a UI não atualiza para mostrar o card verde "NFSe Enviada" - o botão "Enviar NFSe" continua visível.

### Causa Raiz: Query Key Mismatch

No arquivo `MeuFechamento.tsx` (linha 89):
```tsx
queryClient.invalidateQueries({ queryKey: ['own-payout', selectedMonth] });
```

Porém, no hook `useOwnFechamento.ts` (linha 89), a query usa **3 elementos** na key:
```tsx
queryKey: ['own-payout', anoMes, sdrRecord?.id],
```

A invalidação usa apenas 2 elementos `['own-payout', selectedMonth]`, mas a query real tem 3 elementos `['own-payout', anoMes, sdrRecord?.id]`. O React Query faz match parcial, **mas a invalidação não está funcionando corretamente** porque precisa corresponder ao prefixo exato ou usar a opção correta.

## Solução

Modificar a invalidação para usar um match mais amplo que capture todas as queries do payout:

### Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/fechamento-sdr/MeuFechamento.tsx` | Corrigir a invalidação de queries |

### Implementação

No `handleNfseSuccess`, existem duas opções:

**Opção 1 - Invalidar de forma mais ampla** (Recomendada):
```tsx
const handleNfseSuccess = () => {
  setShowNfseModal(false);
  // Invalida todas as queries que começam com 'own-payout'
  queryClient.invalidateQueries({ 
    queryKey: ['own-payout'],
    exact: false 
  });
};
```

**Opção 2 - Incluir o sdrRecord.id na invalidação**:
```tsx
const handleNfseSuccess = () => {
  setShowNfseModal(false);
  queryClient.invalidateQueries({ 
    queryKey: ['own-payout', selectedMonth, userRecord?.id] 
  });
};
```

A **Opção 1** é mais robusta pois não depende de ter o `userRecord` disponível no escopo e garante que todas as queries relacionadas sejam invalidadas.

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────┐
│                     ANTES (Buggy)                               │
├─────────────────────────────────────────────────────────────────┤
│ 1. Upload NFSe → OK                                             │
│ 2. Insert rh_nfse → OK                                          │
│ 3. Update sdr_month_payout.nfse_id → OK                         │
│ 4. Toast "Sucesso!" → OK                                        │
│ 5. invalidateQueries(['own-payout', '2026-01']) → ❌ No Match   │
│    (Query real: ['own-payout', '2026-01', 'uuid-do-sdr'])       │
│ 6. UI não atualiza → Botão continua visível                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     DEPOIS (Corrigido)                          │
├─────────────────────────────────────────────────────────────────┤
│ 1-4. (Igual)                                                    │
│ 5. invalidateQueries(['own-payout'], exact: false) → ✅ Match   │
│ 6. React Query refetch → payout.nfse_id agora preenchido        │
│ 7. UI atualiza → Card verde "NFSe Enviada" aparece              │
└─────────────────────────────────────────────────────────────────┘
```

## Resultado Esperado

Após o fix:
1. Cleiton envia a NFSe
2. Toast "NFSe enviada com sucesso!" aparece
3. Modal fecha
4. Card laranja "Fechamento Aprovado!" **desaparece**
5. Card verde "NFSe Enviada" **aparece** com botão "Ver NFSe"

## Impacto

- **1 linha** de código modificada
- **Nenhuma mudança** no banco de dados
- **Nenhum efeito colateral** - apenas garante que a query seja refetch
