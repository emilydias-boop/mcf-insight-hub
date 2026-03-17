

## Corrigir Webhook ClientData Inside — 2 bugs

### Bug 1: Upsert `lead_profiles` falhando (erro 42P10)
O índice `idx_lead_profiles_contact` é parcial (`WHERE contact_id IS NOT NULL`), o que impede o Postgres de usá-lo no `ON CONFLICT`. Solução: criar uma constraint UNIQUE real (não parcial) em `contact_id`.

**Migration SQL:**
```sql
DROP INDEX IF EXISTS idx_lead_profiles_contact;
ALTER TABLE lead_profiles ADD CONSTRAINT lead_profiles_contact_id_unique UNIQUE (contact_id);
```

### Bug 2: Validação de campos obrigatórios antes do field_mapping
Linha 77 do `webhook-lead-receiver/index.ts` verifica `payload['name']`, mas o ClientData envia `nome_completo`. O `field_mapping` só é aplicado depois. Solução: aplicar o field_mapping reverso antes da validação (se `nome_completo` mapeia para `name`, verificar se `payload['nome_completo']` existe).

**Alteração em `webhook-lead-receiver/index.ts` (linhas 75-85):**
Antes da validação, inverter o field_mapping para criar aliases no payload:
```typescript
// Apply reverse field mapping so required_fields validation works
if (endpoint.field_mapping) {
  for (const [sourceField, targetField] of Object.entries(endpoint.field_mapping)) {
    if (payload[sourceField] !== undefined && !payload[targetField]) {
      payload[targetField] = payload[sourceField];
    }
  }
}
// Then validate required_fields
```

### Arquivos
| Arquivo | Ação |
|---|---|
| Migration SQL | Substituir índice parcial por UNIQUE constraint em `contact_id` |
| `supabase/functions/webhook-lead-receiver/index.ts` | Aplicar field_mapping reverso antes da validação de required_fields (linha ~75) |

