

## Plano: Reverter importação incorreta do Consórcio

### O que aconteceu
Foram criados **42 deals** com apenas números de telefone no campo "nome" (ex: "53 9951-6618", "11986907530"), todos:
- Estágio: **LEAD SCORE** (`663f0eeb-...`)
- Owner: `ygor.ferreira@minhacasafinanciada.com`
- Criados entre `2026-03-20 14:28:48` e `14:28:51`
- Cada deal criou um **contato** associado

### Ação
Executar via SQL (migration):

1. **Deletar os 42 deals** com filtro seguro:
   - `stage_id = '663f0eeb-...'`
   - `owner_id = 'ygor.ferreira@...'`
   - `name` é apenas números/espaços/hífens
   - `created_at` entre `14:28:48` e `14:28:52` do dia 20/03

2. **Deletar os contatos órfãos** criados junto (contatos que não estão vinculados a nenhum outro deal)

### Detalhes técnicos

```sql
-- 1. Delete deals (42 registros)
DELETE FROM crm_deals 
WHERE stage_id = '663f0eeb-6ad1-4880-851b-7ad4cee4089a'
  AND owner_id = 'ygor.ferreira@minhacasafinanciada.com'
  AND name ~ '^\(?[0-9 \-\(\)]+$'
  AND created_at >= '2026-03-20 14:28:00+00'
  AND created_at <= '2026-03-20 14:29:00+00';

-- 2. Delete orphaned contacts (que não têm mais deals)
DELETE FROM crm_contacts 
WHERE id IN (
  SELECT c.id FROM crm_contacts c
  LEFT JOIN crm_deals d ON d.contact_id = c.id
  WHERE d.id IS NULL
  AND c.created_at >= '2026-03-20 14:28:00+00'
  AND c.created_at <= '2026-03-20 14:29:00+00'
);
```

Isso será feito via **migration SQL** no Supabase, sem alteração de código da aplicação.

