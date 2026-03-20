

## Plano: Testar e corrigir fluxo Acordo no Carrinho → Cobranças

### Problema identificado (sem precisar testar no browser)

Ao criar um acordo pela aba Vendas, o `useCreateAgreement` invalida apenas:
- `['billing-agreements']`
- `['billing-agreement-installments']`
- `['billing-history']`

**Faltam invalidações** para os caches usados no Carrinho:
- `['agreements-by-emails']` — usado no R2VendasList (badge de acordo)
- `['aprovado-agreements']` / `['aprovado-agreements-batch']` — usado nos Aprovados

Resultado: após criar o acordo, o badge na tabela de Vendas **não atualiza** até dar F5. Em Cobranças, o acordo **aparece corretamente** porque os dados estão no banco e a query de agreements é feita ao abrir o drawer.

### Correção

| Arquivo | O que muda |
|---------|-----------|
| `src/hooks/useBillingAgreements.ts` | No `onSuccess` de `useCreateAgreement`, adicionar invalidação de `['agreements-by-emails']`, `['aprovado-agreements']` e `['aprovado-agreements-batch']` |
| `src/hooks/useBillingAgreements.ts` | No `onSuccess` de `useUpdateAgreement` e `useMarkAgreementInstallmentPaid`, adicionar as mesmas invalidações para manter consistência |

### Detalhe da mudança

```typescript
// useCreateAgreement → onSuccess
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['billing-agreements'] });
  queryClient.invalidateQueries({ queryKey: ['billing-agreement-installments'] });
  queryClient.invalidateQueries({ queryKey: ['billing-history'] });
  // NEW: invalidar caches do Carrinho R2
  queryClient.invalidateQueries({ queryKey: ['agreements-by-emails'] });
  queryClient.invalidateQueries({ queryKey: ['aprovado-agreements'] });
  queryClient.invalidateQueries({ queryKey: ['aprovado-agreements-batch'] });
},
```

A mesma adição nos `onSuccess` de `useUpdateAgreement` e `useMarkAgreementInstallmentPaid`.

Isso garante que ao criar/atualizar/pagar parcela de um acordo, os badges no Carrinho R2 (Vendas e Aprovados) atualizam automaticamente sem precisar recarregar a página.

