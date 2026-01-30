

# Plano: Corrigir Listagem de Transações do Incorporador

## Problemas Identificados

### Problema 1: Duplicação de linhas `newsale-`
Na imagem você pode ver que cada venda aparece **duas vezes**:
- Uma com bruto normal (ex: R$ 14.500,00) → Marcada como "Novo"
- Uma com R$ 0,00 (dup) → Marcada como "Recorrente"

**Causa**: Os registros `newsale-` são pré-vendas que a Hubla envia antes do pagamento ser confirmado. Depois, chega a transação real com outro `hubla_id`. Ambos estão sendo listados.

**Dados**: De 4.911 transações no período, **1.736 são `newsale-`** e 1.734 deles são duplicados da transação real.

### Problema 2: Produtos que não são do Incorporador
Aparecem produtos como:
- `Imersão: Do Zero ao Milhão na Construção` (categoria: `imersao`)
- `A010 - Consultoria Construa para Vender` (categoria: `a010`)
- Outros de categorias: `efeito_alavanca`, `clube_arremate`, etc.

**Causa**: A função `get_all_hubla_transactions` não filtra por `product_category = 'incorporador'`.

---

## Solução

Modificar a função `get_all_hubla_transactions` para:

1. **Excluir registros `newsale-`** (duplicados)
2. **Filtrar apenas `product_category = 'incorporador'`**

### Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Total transações | 4.868 | ~822 |
| Duplicações | Sim | Não |
| Produtos estranhos | Sim | Não |

---

## Detalhes Técnicos

### Nova Lógica SQL

```sql
WHERE ht.sale_status IN ('completed', 'refunded')
  AND ht.source IN ('hubla', 'manual')
  AND ht.product_category = 'incorporador'      -- Apenas incorporador
  AND ht.hubla_id NOT LIKE 'newsale-%'          -- Exclui newsale duplicados
  AND (p_start_date IS NULL OR ht.sale_date >= p_start_date)
  AND (p_end_date IS NULL OR ht.sale_date <= p_end_date)
  -- filtros de busca...
ORDER BY ht.sale_date DESC
LIMIT p_limit;
```

### Produtos que serão incluídos (categoria `incorporador`)
- A000 - Contrato (497 vendas)
- A000 - Contrato MCF (86 vendas)
- A001 - MCF INCORPORADOR COMPLETO (67 vendas)
- A003 - MCF Plano Anticrise Completo (3 vendas)
- A004 - MCF Plano Anticrise Básico (7 vendas)
- A005 - MCF P2 (33 vendas)
- A008 - The CLUB (1 venda)
- A009 - MCF INCORPORADOR COMPLETO + THE CLUB (117 vendas)
- Contrato - Sócio MCF (9 vendas)

### Produtos que serão EXCLUÍDOS
- A010 - Consultoria (categoria: `a010`)
- Imersão: Do Zero ao Milhão (categoria: `imersao`)
- Imersão Presencial Alphaville (categoria: `imersao`)
- Efeito Alavanca (categoria: `efeito_alavanca`)
- Clube do Arremate (categoria: `clube_arremate`)

---

## Implementação

1. Executar migração SQL para recriar a função `get_all_hubla_transactions` com os novos filtros

