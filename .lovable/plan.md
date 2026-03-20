

## Plano: Deletar 24 deals duplicados da última importação

### Situação

A importação criou 57 deals. Desses, 24 são duplicatas de deals que já existiam em stages avançados (VENDA REALIZADA, R1 Realizada, CARTA + APORTE, etc.). Os originais estão intactos — os 24 clones em LEAD SCORE devem ser removidos.

Os outros 33 são novos e devem permanecer.

### Ação — Migration SQL

```sql
-- Delete only the 24 duplicate deals from today's import
-- that share a name with an older deal in the same origin
DELETE FROM crm_deals
WHERE id IN (
  SELECT new.id
  FROM crm_deals new
  JOIN crm_deals old ON lower(trim(new.name)) = lower(trim(old.name))
    AND new.id != old.id
    AND old.origin_id = '7d7b1cb5-2a44-4552-9eff-c3b798646b78'
    AND old.created_at < '2026-03-20 14:00:00+00'
  WHERE new.origin_id = '7d7b1cb5-2a44-4552-9eff-c3b798646b78'
    AND new.created_at >= '2026-03-20 16:40:00+00'
);

-- Delete orphaned contacts
DELETE FROM crm_contacts
WHERE clint_id LIKE 'csv_import_%'
  AND created_at >= '2026-03-20 16:40:00+00'
  AND id NOT IN (SELECT contact_id FROM crm_deals WHERE contact_id IS NOT NULL);
```

### Resultado esperado

- **24 deals duplicados** removidos (clones em LEAD SCORE)
- **33 deals novos** preservados
- Deals originais (VENDA REALIZADA, R1, etc.) intactos
- Contatos órfãos dos duplicados também removidos

### Correção futura no parser

Após a limpeza, o `process-csv-imports` precisa de verificação de duplicatas no banco (check `contact_id + origin_id` antes de inserir) para evitar que isso aconteça novamente.

