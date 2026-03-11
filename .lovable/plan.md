

## Problema

A aba **Vendas** não filtra por carrinho porque:

1. **`R2VendasList` busca dados próprios** (linha 71) ignorando o filtro de carrinho aplicado no `R2Carrinho.tsx`
2. **Falta o `scheduled_at` da reunião R2** nas vendas — o `filterByCarrinho` usa `sale_date` (data da transação) em vez da data da reunião R2 do lead, que é o que determina a qual carrinho a venda pertence
3. Os KPIs de vendas no badge da aba também não refletem o filtro

## Solução

### 1. `src/hooks/useR2CarrinhoVendas.ts` — Incluir `scheduled_at` da reunião R2

- Ao montar cada `R2CarrinhoVenda`, incluir o campo `r2_scheduled_at` com o `meeting_slot.scheduled_at` do attendee aprovado correspondente
- Isso permite que o `filterByCarrinho` use a data da reunião R2 (não a data da venda) para classificar em qual carrinho a venda pertence

### 2. `src/components/crm/R2VendasList.tsx` — Aceitar dados filtrados via props

- Adicionar prop opcional `vendas?: R2CarrinhoVenda[]` ao componente
- Quando recebido, usar esses dados filtrados em vez de buscar independentemente
- Manter o fetch próprio como fallback quando a prop não é passada

### 3. `src/pages/crm/R2Carrinho.tsx` — Passar dados filtrados e corrigir filtro

- Passar `vendasData` filtrado como prop para `R2VendasList`
- Corrigir o `filterByCarrinho` para usar `item.r2_scheduled_at` (data da reunião R2) em vez de `item.sale_date`
- Atualizar o badge de vendas na aba para usar `vendasData.length` (já filtrado)

### Resultado

- Carrinho 1: mostra apenas vendas de leads cujas R2s caem no Carrinho 1
- Carrinho 2: mostra apenas vendas de leads cujas R2s caem no Carrinho 2
- Sem duplicação entre carrinhos

