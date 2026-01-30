
# Plano: Buscar Produtos do Banco no Formulário de Transação

## Problema Identificado

O dropdown de produtos no `TransactionFormDialog` está usando uma **lista hardcoded** de apenas 8 produtos:

```javascript
const PRODUCTS = [
  { code: "A000", name: "A000 - Contrato", price: 497 },
  { code: "A001", name: "A001 - MCF INCORPORADOR COMPLETO", price: 14500 },
  // ... apenas 8 produtos
];
```

Mas no banco (`product_configurations`) existem **21+ produtos** configurados para a BU `incorporador`, incluindo:
- A000 - Pré-Reserva Plano Anticrise (R$ 997)
- A010 - Construa para Vender sem Dinheiro (R$ 47)
- ACESSO VITALÍCIO (R$ 57)
- E outros produtos de lançamento

Isso impede que você altere uma transação para um produto de lançamento.

---

## Solução

Modificar o `TransactionFormDialog` para:
1. Buscar produtos do banco de dados usando o hook `useProductConfigurations` que já existe
2. Filtrar apenas produtos da BU `incorporador` e ativos (`is_active = true`)
3. Usar `product_name` como chave única (em vez de `code`)
4. Manter fallback para a lista hardcoded enquanto carrega

---

## Mudanças Técnicas

### Arquivo: `src/components/incorporador/TransactionFormDialog.tsx`

1. **Importar hook existente**:
```typescript
import { useProductConfigurations } from "@/hooks/useProductConfigurations";
```

2. **Buscar produtos do banco**:
```typescript
const { data: allProducts, isLoading: isLoadingProducts } = useProductConfigurations();

// Filtrar para BU incorporador e ativos
const productsFromDB = useMemo(() => {
  if (!allProducts) return [];
  return allProducts
    .filter(p => p.target_bu === 'incorporador' && p.is_active)
    .map(p => ({
      name: p.product_name,
      price: p.reference_price,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}, [allProducts]);
```

3. **Atualizar schema** (usar `product_name` em vez de `product_code`):
```typescript
const formSchema = z.object({
  product_name: z.string().min(1, "Selecione um produto"), // Mudança aqui
  // ... resto igual
});
```

4. **Atualizar dropdown**:
```typescript
<Select value={field.value} onValueChange={field.onChange}>
  <SelectTrigger>
    <SelectValue placeholder="Selecione o produto" />
  </SelectTrigger>
  <SelectContent className="max-h-60">
    {productsFromDB.map((p) => (
      <SelectItem key={p.name} value={p.name}>
        {p.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

5. **Auto-fill de preço quando produto muda**:
```typescript
useEffect(() => {
  if (selectedProductName && mode === "create") {
    const product = productsFromDB.find((p) => p.name === selectedProductName);
    if (product) {
      setValue("product_price", product.price);
    }
  }
}, [selectedProductName, productsFromDB, mode, setValue]);
```

6. **Carregar produto correto ao editar**:
```typescript
// Ao editar, usar o product_name direto da transação
reset({
  product_name: transaction.product_name || "",
  // ... resto igual
});
```

---

## Benefícios

1. **Todos os produtos de lançamento** aparecem no dropdown
2. **Preço correto** é preenchido automaticamente baseado no `reference_price` do banco
3. **Centralizado**: Alterações na tabela `product_configurations` refletem automaticamente no formulário
4. **Consistência**: Mesmo catálogo usado em relatórios e no formulário

---

## Resultado Esperado

- Ao editar a transação do Rodrigo Jesus, você poderá trocar de "A000 - Contrato" para qualquer produto de lançamento configurado no banco
- O preço bruto padrão será atualizado automaticamente
- A transação será salva com o novo `product_name`
