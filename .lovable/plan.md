

## Plano: Remover 235 deals duplicados do backfill

### Problema confirmado
235 dos 329 deals criados hoje pelo backfill são duplicados — os leads já existiam no PIS com deals em estágios como Reunião Realizada (71), Sem Interesse (66), Contrato Pago (9), etc. A causa foi contatos duplicados com mesmo email mas `contact_id` diferente.

### Ação

| Passo | O que fazer |
|-------|-------------|
| 1 | **Deletar os 235 deals duplicados** — deals criados em 24/03 com tag `Backfill` no PIS cujo email já tinha deal anterior |
| 2 | **Deletar contatos órfãos** — contatos com tag `Backfill` que ficaram sem nenhum deal |
| 3 | **Verificar** que restam exatamente 94 deals legítimos do backfill |

### SQL (via insert tool para DELETE)

```sql
-- 1. Deletar deals duplicados
DELETE FROM crm_deals 
WHERE id IN (
  SELECT d1.id
  FROM crm_deals d1
  JOIN crm_contacts c1 ON d1.contact_id = c1.id
  WHERE d1.created_at >= '2026-03-24'
    AND d1.tags @> ARRAY['Backfill']
    AND d1.origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c'
    AND LOWER(TRIM(c1.email)) IN (
      SELECT LOWER(TRIM(c2.email))
      FROM crm_deals d2
      JOIN crm_contacts c2 ON d2.contact_id = c2.id
      WHERE d2.origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c'
        AND d2.created_at < '2026-03-24'
        AND c2.email IS NOT NULL
    )
);

-- 2. Deletar contatos órfãos do backfill
DELETE FROM crm_contacts
WHERE tags @> ARRAY['Backfill']
  AND NOT EXISTS (SELECT 1 FROM crm_deals WHERE contact_id = crm_contacts.id);
```

### Próximo passo
Corrigir a função `backfill-a010-missing-deals` para deduplicar por **email cross-contact** (buscar deals via JOIN com todos os contatos que compartilham o mesmo email) em vez de verificar apenas o `contact_id` específico.

