

# Otimizar Backfill: Resolver Timeout na Classificação

## Problema

A função leva ~30s+ só na fase de classificação (linhas 86-138), percorrendo 1700+ emails em chunks de 50, fazendo 2 queries por chunk (contacts + deals). Isso causa timeout antes de chegar na fase de criação de deals.

## Solução

### Arquivo: `supabase/functions/backfill-orphan-a010-deals/index.ts`

**Estratégia: Usar `months=1` como default e adicionar parâmetro `offset` para pular emails já processados.**

Mas a solução mais eficiente é **mover a classificação para uma única query SQL** em vez de N queries via SDK:

1. **Substituir o loop de classificação (linhas 82-150)** por uma abordagem em 2 queries apenas:
   - Query 1: Buscar todos os emails A010 que **já têm deal** nesta origin (uma única query com JOIN)
   - Query 2: Buscar contatos não-arquivados para os emails que **não** estão no resultado da query 1

2. **Criar uma RPC `get_a010_orphan_emails`** que faz tudo em SQL:
```sql
CREATE FUNCTION get_a010_orphan_emails(p_origin_id uuid, p_since timestamptz, p_limit int)
RETURNS TABLE(email text, contact_id uuid, contact_name text)
AS $$
  SELECT DISTINCT ON (lower(ht.customer_email))
    lower(ht.customer_email) as email,
    c.id as contact_id,
    c.name as contact_name
  FROM hubla_transactions ht
  JOIN crm_contacts c ON lower(c.email) = lower(ht.customer_email) AND c.is_archived = false
  WHERE ht.product_category = 'a010'
    AND ht.sale_status = 'completed'
    AND ht.created_at >= p_since
    AND NOT EXISTS (
      SELECT 1 FROM crm_deals d
      JOIN crm_contacts c2 ON c2.id = d.contact_id
      WHERE d.origin_id = p_origin_id
        AND lower(c2.email) = lower(ht.customer_email)
    )
  ORDER BY lower(ht.customer_email), c.created_at ASC
  LIMIT p_limit;
$$ LANGUAGE sql STABLE;
```

3. **Simplificar a edge function**: Chamar a RPC, receber direto a lista de orphans prontos para processar, e criar os deals sem a fase de classificação pesada.

### Mudanças

1. **Migration**: Criar a function SQL `get_a010_orphan_emails`
2. **Edge function**: Substituir linhas 48-150 por uma chamada `supabase.rpc('get_a010_orphan_emails', {...})` e processar direto

### Resultado esperado
- Classificação que levava 30s+ passa a levar ~1-2s (uma query SQL otimizada)
- Com limit=10, a função toda roda em ~5s
- Podemos processar todos os 64 orphans restantes em poucas chamadas

