

## Plano: Criar 4 deals faltantes + limpar 3 duplicatas internas

### Passo 1 — Criar os 4 deals faltantes (período 90-120 dias)

Executar a Edge Function `backfill-a010-missing-deals` com `days_back: 130` e `dry_run: false`. A função já tem dedup por email cross-contact e por telefone, então só vai criar deals para os 4 que realmente faltam (Mateus Santos, Jovane Monteiro, Adrielson Pereira, Marcel Klaczko Neto). Todos os outros ~1.000+ serão filtrados.

Chamada: `supabase.functions.invoke('backfill-a010-missing-deals', { body: { dry_run: false, days_back: 130, limit: 500 } })`

### Passo 2 — Deletar 3 duplicatas internas do backfill

SQL via insert tool para deletar os 3 deals mais novos de cada par duplicado interno (Carlos Wesley, Higor Coura, Robert Douglas — mesma pessoa com 2 deals do backfill, emails diferentes mas mesmo telefone):

```sql
-- Identificar e deletar o deal mais novo de cada par interno duplicado
DELETE FROM crm_deals
WHERE id IN (
  SELECT d1.id
  FROM crm_deals d1
  JOIN crm_contacts c1 ON d1.contact_id = c1.id
  WHERE d1.tags @> ARRAY['Backfill']
    AND d1.origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c'
    AND d1.created_at >= '2026-03-24'
    AND c1.phone IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM crm_deals d2
      JOIN crm_contacts c2 ON d2.contact_id = c2.id
      WHERE d2.tags @> ARRAY['Backfill']
        AND d2.origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c'
        AND d2.created_at >= '2026-03-24'
        AND d2.id != d1.id
        AND d1.created_at > d2.created_at
        AND c2.phone IS NOT NULL
        AND RIGHT(REGEXP_REPLACE(c2.phone, '\D', '', 'g'), 9) 
          = RIGHT(REGEXP_REPLACE(c1.phone, '\D', '', 'g'), 9)
    )
);
```

### Passo 3 — Limpar contatos órfãos

```sql
DELETE FROM crm_contacts
WHERE tags @> ARRAY['Backfill']
  AND NOT EXISTS (SELECT 1 FROM crm_deals WHERE contact_id = crm_contacts.id);
```

### Resultado esperado

- **+4 deals** criados (Mateus, Jovane, Adrielson, Marcel)
- **-3 deals** duplicatas internas removidas
- **~37 deals** legítimos finais no backfill

