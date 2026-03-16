

## Corrigir `stage_moved_at` para refletir tempo real na stage

### Problema raiz
O campo `stage_moved_at` nao esta sendo atualizado de forma confiavel quando deals mudam de stage. A logica client-side no `useUpdateCRMDeal` esta correta, mas webhooks (upsert com `onConflict: 'clint_id'`) e o trigger de replicacao podem sobrescrever o valor. Resultado: o relogio ao lado do nome mostra o mesmo tempo que o tempo no sistema.

### Solucao

**1. Criar trigger no banco de dados** (via SQL no Supabase)

Trigger `BEFORE UPDATE` em `crm_deals` que detecta mudanca em `stage_id` e seta `stage_moved_at = now()` automaticamente. Isso garante que qualquer caminho (UI, webhook, edge function) atualize o campo corretamente.

```sql
CREATE OR REPLACE FUNCTION update_stage_moved_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    NEW.stage_moved_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_stage_moved_at
  BEFORE UPDATE ON crm_deals
  FOR EACH ROW
  EXECUTE FUNCTION update_stage_moved_at();
```

**2. Backfill dos dados existentes** (via SQL)

Para deals que tem `stage_moved_at ≈ created_at` mas possuem historico de mudanca de stage em `deal_activities`, atualizar com a data da ultima mudanca registrada:

```sql
UPDATE crm_deals d
SET stage_moved_at = sub.last_move
FROM (
  SELECT deal_id::uuid AS did, MAX(created_at) AS last_move
  FROM deal_activities
  WHERE activity_type IN ('stage_change','stage_changed')
  GROUP BY deal_id
) sub
WHERE d.id = sub.did
  AND ABS(EXTRACT(EPOCH FROM (d.stage_moved_at - d.created_at))) < 120;
```

**3. Limpar logica duplicada no client** (`src/hooks/useCRMData.ts`)

Remover as linhas 587-591 que setam `stage_moved_at` manualmente no mutation, ja que o trigger cuida disso. Manter `last_worked_at` que nao tem trigger.

### Resultado
- O relogio ao lado do nome mostrara o tempo correto na stage atual
- O tempo no canto inferior direito continua mostrando tempo no sistema
- Qualquer caminho de mudanca de stage (drag, webhook, edge function) sera coberto pelo trigger

