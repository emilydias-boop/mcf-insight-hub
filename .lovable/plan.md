

## Plano: Reembolso Reseta a Classificação Novo/Recorrente

### Situação atual do Caio Belardi (A000 - Contrato)

```text
03/03  cb2265  refunded   R$497  → rn=1 (Novo) ✅ já está correto
04/13  fcb8b0  completed  R$497  → rn=2 (Recorrente) ❌ deveria ser Novo
```

A RPC `get_first_transaction_ids` faz ranking de TODAS as transações (completed + refunded) juntas. Como a refundada de março vem primeiro, ela fica rn=1, e a nova compra de abril fica rn=2 (Recorrente).

### Regra correta

- Transação **refundada** = sempre **Novo** (foi uma tentativa de compra)
- Transação **completed** após um reembolso do mesmo cliente/produto = **Novo** (o reembolso "reseta" o ciclo)

### Resultado esperado

```text
03/03  cb2265  refunded   → Novo ✅
04/13  fcb8b0  completed  → Novo ✅ (corrigido!)
```

### Alteração

**Migração no banco de dados: alterar a função `get_first_transaction_ids`**

Dividir a lógica em duas partes:

1. **Ranking apenas de transações `completed`** — exclui `refunded` do `WHERE`. Assim, a transação de abril do Caio vira rn=1 (primeira completed para esse email+produto)
2. **UNION com todas as transações `refunded`** — transações reembolsadas são sempre consideradas "Novo"

Mudança no SQL:

```sql
-- PARTE 1: primeira completed por email+produto (refundadas excluídas do ranking)
ranked_transactions AS (
  SELECT ...
  WHERE ht.sale_status = 'completed'   -- era: IN ('completed', 'refunded')
  ...
)
SELECT id FROM ranked_transactions WHERE rn = 1

UNION

-- PARTE 2: todas as refundadas são "Novo"
SELECT ht.id FROM hubla_transactions ht
INNER JOIN product_configurations pc ON ...
WHERE ht.sale_status = 'refunded'
  AND ht.hubla_id NOT LIKE 'newsale-%'
  AND ht.source IN ('hubla', 'manual', 'make')
  ...
```

### Impacto

- Caio Belardi: ambas transações (março e abril) serão "Novo"
- Qualquer outro cliente que reembolsou e recomprou será corrigido automaticamente
- Nenhuma alteração no frontend — os hooks já consomem o resultado da RPC
- O cálculo de Bruto Total (via `getDeduplicatedGross`) também será ajustado

