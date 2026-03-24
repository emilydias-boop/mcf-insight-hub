

## Plano: Remover 58 deals duplicados restantes (match por telefone)

### Problema
A limpeza anterior removeu 235 duplicatas por email exato, mas **58 deals** ainda estão duplicados — mesma pessoa com **emails diferentes** mas **mesmo telefone** (últimos 9 dígitos). Exemplos: Jhonatas (Contrato Pago), Fabio Gomes (Contrato Pago), Victor Romão (Contrato Pago).

### Ação

| Passo | O que fazer |
|-------|-------------|
| 1 | **Deletar os 58 deals do backfill** que têm match por telefone com deal anterior no PIS |
| 2 | **Deletar contatos órfãos** do backfill que ficarem sem deal |
| 3 | **Verificar** que restam ~36 deals legítimos (94 - 58) |

### SQL

```sql
-- 1. Deletar deals backfill duplicados por telefone
DELETE FROM crm_deals
WHERE id IN (
  SELECT d1.id
  FROM crm_deals d1
  JOIN crm_contacts c1 ON d1.contact_id = c1.id
  WHERE d1.created_at >= '2026-03-24'
    AND d1.tags @> ARRAY['Backfill']
    AND d1.origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c'
    AND c1.phone IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM crm_deals d2
      JOIN crm_contacts c2 ON d2.contact_id = c2.id
      WHERE d2.origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c'
        AND d2.id != d1.id
        AND d2.created_at < '2026-03-24'
        AND c2.phone IS NOT NULL
        AND RIGHT(REGEXP_REPLACE(c2.phone, '\D', '', 'g'), 9) 
          = RIGHT(REGEXP_REPLACE(c1.phone, '\D', '', 'g'), 9)
    )
);

-- 2. Deletar contatos órfãos do backfill
DELETE FROM crm_contacts
WHERE tags @> ARRAY['Backfill']
  AND NOT EXISTS (SELECT 1 FROM crm_deals WHERE contact_id = crm_contacts.id);
```

### Próximo passo
Após limpeza, corrigir a Edge Function `backfill-a010-missing-deals` para incluir dedup por telefone cross-contact (além de email) antes de qualquer execução futura.

