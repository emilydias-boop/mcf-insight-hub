

# Corrigir Backfill A010: Tags inconsistentes + Orlando sem deal

## Problema

O backfill não está encontrando todos os órfãos (incluindo Orlando) por causa de **dois formatos de tags** no `crm_contacts`:

1. **Texto simples**: `['A010', 'Hubla']` — criado pelo webhook Hubla/Make (29 contatos em abril)
2. **Objetos JSON**: `[{"id":"...","name":"A010 - Consultoria..."}]` — criado pelo sync Clint (96+ contatos em abril)

O backfill atual busca `tags @> ARRAY['A010']` que só encontra o formato 1. Resultado: de **55 órfãos reais** em abril (com pagamento A010 confirmado), o backfill só consegue ver ~20.

Orlando tem tags `[{"id":null,"name":null,"color":null}]` — nem texto nem JSON com nome. Ele nunca seria encontrado pela busca de tags.

## Solução

### Arquivo: `supabase/functions/backfill-orphan-a010-deals/index.ts`

**Mudar a estratégia de busca**: em vez de procurar pela tag no contato, buscar diretamente pela transação confirmada no `hubla_transactions`. Isso é 100% confiável:

```text
Lógica atual (falha):
  crm_contacts WHERE tags @> ['A010'] AND NOT EXISTS deal

Lógica corrigida:
  crm_contacts WHERE email IN (
    SELECT customer_email FROM hubla_transactions 
    WHERE product_category = 'a010' AND sale_status = 'completed'
  ) AND NOT EXISTS deal
```

Mudanças específicas:

1. **Query RPC**: Substituir `c.tags @> ARRAY['A010']` por um JOIN com `hubla_transactions` onde `product_category = 'a010'` e `sale_status = 'completed'`

2. **Fallback manual**: Substituir `.contains('tags', ['A010'])` por uma busca em duas etapas:
   - Primeiro buscar emails com transação A010 confirmada
   - Depois buscar contatos com esses emails que não têm deal

3. **Manter o resto**: A lógica de deduplicação, partner check, distribuição e upsert continua igual

## Resultado esperado
- Orlando e todos os 55 órfãos de abril são encontrados
- Não depende mais do formato das tags (que é inconsistente)
- Backfill passa a usar a fonte de verdade: o pagamento confirmado na `hubla_transactions`

