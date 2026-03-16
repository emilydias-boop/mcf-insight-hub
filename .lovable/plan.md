

## Corrigir detecção de Outside: query de parceiros muito ampla

### Problema
A query `partnerTransactions` em `useOutsideDetectionForDeals.ts` usa lógica invertida: busca "tudo que NÃO é contrato" como parceiro. Isso inclui A010, cursos e outros produtos legítimos, causando falsos negativos na detecção Outside.

Epson comprou A010 (curso) + Contrato (hoje), sem R1 → deveria ser Outside, mas A010 o marca como "parceiro" indevidamente.

### Correção

**`src/hooks/useOutsideDetectionForDeals.ts`** — linhas 105-118

Substituir a query genérica por uma que busca **especificamente** produtos de parceria, alinhando com `checkIfPartner` do backend:

```typescript
// Partner products: detect emails that bought actual partnership products
batchedIn<{ customer_email: string | null }>(
  (chunk) =>
    supabase
      .from('hubla_transactions')
      .select('customer_email')
      .in('customer_email', chunk)
      .eq('sale_status', 'completed')
      .or('product_name.ilike.%A001%,product_name.ilike.%A002%,product_name.ilike.%A003%,product_name.ilike.%A004%,product_name.ilike.%A009%,product_name.ilike.%INCORPORADOR%,product_name.ilike.%ANTICRISE%'),
  uniqueEmails
),
```

Isso garante que apenas emails com compras de parceria real sejam excluídos da detecção Outside. A010, cursos e outros produtos não serão mais tratados como parceria.

