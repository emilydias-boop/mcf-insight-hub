

## Fix: Preços dos produtos de parceria hardcoded no dialog de edição

### Problema

O `R2CarrinhoTransactionFormDialog.tsx` usa uma lista `PARCERIA_PRODUCTS` hardcoded (linhas 43-48) com preços antigos (ex: A001 = R$ 14.500). Quando o usuário seleciona um produto ou edita uma venda, o "Valor Bruto" vem dessa lista ao invés dos preços configurados na aba Produtos (`product_configurations`).

### Correção

**`src/components/crm/R2CarrinhoTransactionFormDialog.tsx`**:

1. **Remover `PARCERIA_PRODUCTS` hardcoded** (linhas 43-48)
2. **Importar `useProductConfigurations`** e buscar produtos com `product_category = 'parceria'` (ou categorias relevantes como `incorporador`, `parceria`, `ob_vitalicio`)
3. **Construir lista dinâmica** a partir de `product_configurations`, usando `reference_price` como preço exibido no dropdown
4. **Atualizar `handleProductChange`** (linhas 148-156) para usar o `reference_price` da configuração ao invés do preço hardcoded
5. **Atualizar o dropdown** (renderização dos `SelectItem`) para mostrar o preço dinâmico

Resultado: quando o preço é alterado na aba Produtos, o dropdown e o auto-preenchimento do dialog refletem imediatamente.

### Arquivo alterado
- `src/components/crm/R2CarrinhoTransactionFormDialog.tsx`

