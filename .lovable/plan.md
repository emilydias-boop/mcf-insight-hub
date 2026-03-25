

## Plano: Corrigir bug de importação + prevenir no futuro

### Parte 1 — Corrigir o bug na edge function (futuras importações)
**Arquivo:** `supabase/functions/import-spreadsheet-leads/index.ts`

Na lógica de update de deals existentes sem reunião (linhas 159-166), condicionar a atualização do `stage_id` apenas quando `customStageId` foi passado explicitamente:

```typescript
// ANTES (bug): sempre reseta para firstStageId
updateData = { stage_id: firstStageId, tags: finalTags };

// DEPOIS (fix): só atualiza stage se customStageId foi escolhido
updateData = { tags: finalTags };
if (customStageId) updateData.stage_id = firstStageId;
```

### Parte 2 — Tabela de histórico de stages (novo)
Criar tabela `deal_stage_history` para registrar cada mudança de stage, permitindo reversão no futuro:

```sql
CREATE TABLE deal_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES crm_deals(id) ON DELETE CASCADE NOT NULL,
  from_stage_id uuid REFERENCES crm_stages(id),
  to_stage_id uuid REFERENCES crm_stages(id) NOT NULL,
  changed_by text,
  source text DEFAULT 'manual', -- manual, import, webhook, etc.
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_deal_stage_history_deal ON deal_stage_history(deal_id);
```

Trigger para registrar automaticamente:
```sql
CREATE OR REPLACE FUNCTION log_deal_stage_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    INSERT INTO deal_stage_history (deal_id, from_stage_id, to_stage_id, source)
    VALUES (NEW.id, OLD.stage_id, NEW.stage_id, 'auto');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_stage_change
AFTER UPDATE OF stage_id ON crm_deals
FOR EACH ROW EXECUTE FUNCTION log_deal_stage_change();
```

### Parte 3 — Os 10 deals afetados
Sem histórico, não é possível reverter automaticamente para a stage anterior. São apenas 10 deals — a equipe pode movê-los manualmente. Posso listar os IDs e nomes para facilitar a revisão.

### Arquivos alterados
- `supabase/functions/import-spreadsheet-leads/index.ts` — fix do bug
- Nova migration SQL — tabela `deal_stage_history` + trigger

