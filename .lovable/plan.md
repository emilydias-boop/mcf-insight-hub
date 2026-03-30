

## Vendas desaparecem ao editar — `sale_date` perde horário

### Causa raiz

A janela de **Vendas de Parceria** do Carrinho começa na **sexta-feira às 12:00** (horário de corte). Para a semana 19/03-25/03, a janela é:

```text
27/03 12:00 → 30/03 23:59
```

O Samuel Figueiredo tinha `sale_date = "2026-03-27T16:08:00Z"` (16:08 UTC, dentro da janela).

Ao salvar a edição, o código faz:
```typescript
sale_date: new Date(saleDate).toISOString()
// saleDate = "2026-03-27" (só data, sem hora)
// Resultado: "2026-03-27T00:00:00.000Z" (meia-noite UTC)
```

**Meia-noite UTC é ANTES das 12:00** → a transação cai fora da janela de vendas e desaparece da listagem.

### Solução

No `R2CarrinhoTransactionFormDialog`, ao entrar em modo de edição, preservar o horário original do `sale_date`. Ao submeter, mesclar a data selecionada com o horário original (ou usar o horário atual se for uma data diferente).

### Mudanças

#### `src/components/crm/R2CarrinhoTransactionFormDialog.tsx`

1. Guardar o horário original do `transactionToEdit.sale_date` em um ref/state (ex: `originalSaleTime`)
2. No `handleSubmit`, ao construir o `sale_date`:
   - Se a data não mudou: usar o `sale_date` original completo (com horário)
   - Se a data mudou: usar a nova data + horário atual (`new Date().toTimeString()`)
   - Isso garante que o timestamp nunca caia em meia-noite

#### Alternativa mais simples (preferida)

No `handleSubmit` do modo edit, quando o `saleDate` (yyyy-MM-dd) for igual à data original, enviar o `transactionToEdit.sale_date` original intacto. Caso contrário, usar `new Date(saleDate + 'T12:00:00')` para garantir que fique após o corte.

### Resultado

- Editar uma venda preserva o horário original, mantendo-a na janela correta
- Novas datas usam meio-dia como fallback seguro (sempre após o corte de 12:00)
- Sem mudanças no backend

### Arquivo alterado
1. `src/components/crm/R2CarrinhoTransactionFormDialog.tsx`

