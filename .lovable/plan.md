

## Backfill: A010 com Order Bump — Criar contatos e deals no CRM

### Contexto
65 clientes compraram A010 como order bump (`hubla_id LIKE '%-offer-%'`, `product_category = 'a010'`) mas nunca tiveram contato/deal criado no CRM porque o webhook tratava o A010 como "offer" e pulava a criação.

### Solução
Criar uma nova Edge Function `backfill-a010-offer-leads` que:

1. Busca transações A010 que são offers: `product_category = 'a010'` AND `hubla_id LIKE '%-offer-%'`
2. Deduplica por `customer_email`
3. Para cada email, verifica se já existe contato no `crm_contacts`
4. Verifica se já existe deal no pipeline "PIPELINE INSIDE SALES" para aquele contato
5. Cria contato + deal (usando a mesma lógica do `createOrUpdateCRMContact`) para os que não têm
6. Também insere em `a010_sales` se não existir
7. Suporta `dry_run` (default: true)

### Arquivo
- `supabase/functions/backfill-a010-offer-leads/index.ts` — nova Edge Function
- `supabase/config.toml` — adicionar `[functions.backfill-a010-offer-leads]` com `verify_jwt = false`

### Lógica principal
```text
1. Query: hubla_transactions WHERE product_category='a010' AND hubla_id LIKE '%-offer-%'
2. Deduplica por email (lowercase)
3. Batch lookup: crm_contacts por email
4. Batch lookup: crm_deals por contact_id + origin_id (PIPELINE INSIDE SALES)
5. Para cada email sem deal:
   - Criar crm_contacts se não existe
   - Criar crm_deals com stage "Novo Lead", tags ['A010','Hubla','Backfill-Offer']
   - Upsert a010_sales
6. Retornar stats + details
```

### Segurança
- Reutiliza o padrão existente de `backfill-construir-alugar` (partner check não necessário — já são leads legítimos)
- `dry_run = true` por default para preview seguro

