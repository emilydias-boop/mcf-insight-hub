

# Filtrar produtos na página de Cobranças

## Objetivo
Limitar o dropdown de produtos e os dados exibidos na aba "Parcelados" para mostrar apenas 5 produtos específicos.

## Mapeamento (nome solicitado → produto no banco)

| Produto solicitado | `product_name` no banco |
|---|---|
| Incorporador 50k Completo | `A001 - MCF INCORPORADOR COMPLETO` |
| Incorporador 50k Completo + The Club | `A009 - MCF INCORPORADOR COMPLETO + THE CLUB` e `A009 - MCF INCORPORADOR + THE CLUB` |
| Anticrise Completo | `A003 - MCF Plano Anticrise Completo` |
| Anticrise Básico | `A004 - MCF Plano Anticrise Básico` |
| Plano Construtor Básico | `A002 - MCF INCORPORADOR BÁSICO` |

**Nota:** Não existe "Plano Construtor Básico" no banco. Assumo que se refere ao `A002 - MCF INCORPORADOR BÁSICO`. Se for outro produto, me avise.

## Alteração

### Arquivo: `src/components/financeiro/cobranca/CobrancaFilters.tsx`

Adicionar uma constante com os produtos permitidos e filtrar a lista retornada do banco para mostrar apenas esses no dropdown:

```typescript
const ALLOWED_PRODUCTS = [
  'A001 - MCF INCORPORADOR COMPLETO',
  'A009 - MCF INCORPORADOR COMPLETO + THE CLUB',
  'A009 - MCF INCORPORADOR + THE CLUB',
  'A003 - MCF Plano Anticrise Completo',
  'A004 - MCF Plano Anticrise Básico',
  'A002 - MCF INCORPORADOR BÁSICO',
];
```

Filtrar `products` no `useMemo` ou diretamente no render para exibir somente os permitidos.

### Arquivo: `src/hooks/useBillingSubscriptions.ts`

Adicionar filtro na query do Supabase para retornar apenas subscriptions com `product_name` dentro da lista permitida (usando `.in('product_name', ALLOWED_PRODUCTS)`). Isso garante que KPIs, tabela e contadores reflitam apenas esses produtos.

