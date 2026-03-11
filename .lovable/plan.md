

## Deduplicação de Transações por Prioridade de Fonte

### Problema
As RPCs retornam transações de todas as fontes (hubla, mcfpay, make), causando duplicatas quando a mesma venda existe em múltiplas fontes. No caso do Samuel Barbosa, aparece tanto do `mcfpay` quanto do `make`.

### Solução
Adicionar deduplicação nas RPCs usando `ROW_NUMBER()` com prioridade de fonte: **hubla > kiwify > mcfpay > make**. Para cada combinação de `customer_email + product_name + installment_number`, manter apenas a transação da fonte com maior prioridade.

### Migration SQL

Recriar ambas as RPCs (`get_all_hubla_transactions` e `get_hubla_transactions_by_bu`) com a seguinte lógica:

```sql
WITH ranked AS (
  SELECT ht.*, pc.reference_price,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(ht.customer_email), ht.product_name, ht.installment_number
      ORDER BY CASE ht.source
        WHEN 'hubla' THEN 1
        WHEN 'kiwify' THEN 2
        WHEN 'mcfpay' THEN 3
        WHEN 'manual' THEN 4
        WHEN 'make' THEN 5
        ELSE 6
      END
    ) AS rn
  FROM hubla_transactions ht
  INNER JOIN product_configurations pc ON ht.product_name = pc.product_name
  WHERE [existing filters]
)
SELECT ... FROM ranked WHERE rn = 1
ORDER BY sale_date DESC LIMIT p_limit;
```

Isso garante que:
- Se existe uma transação `hubla` e uma `make` para o mesmo cliente/produto/parcela, só aparece a `hubla`
- Se existe `mcfpay` e `make`, só aparece `mcfpay`
- `make` só aparece se não existir nenhuma outra fonte

### Arquivos
- Nova migration SQL com as duas RPCs atualizadas

