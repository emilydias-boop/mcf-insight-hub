

# Edge Function: merge-duplicate-contacts

## Resumo
Criar a edge function `merge-duplicate-contacts` que deduplica contatos por telefone (sufixo 9 digitos), remapeando deals e attendees para o contato principal (mais antigo) e arquivando os secundarios.

## Alteracoes

### 1. Migration: adicionar colunas em crm_contacts
Adicionar 3 colunas que nao existem hoje:
- `merged_into_contact_id` UUID (FK para crm_contacts.id)
- `merged_at` TIMESTAMPTZ
- `is_archived` BOOLEAN DEFAULT false

### 2. Edge Function: `supabase/functions/merge-duplicate-contacts/index.ts`
Parametros de entrada: `{ dry_run: boolean, batch_size?: number (default 50) }`

Logica principal:
1. Query agrupa contatos por `RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 9)` com `HAVING COUNT(*) > 1`, filtrando apenas grupos que tem deals (`EXISTS crm_deals WHERE contact_id = ANY(ids)`)
2. Ordena contatos por `created_at ASC` -- o mais antigo e o principal
3. Para cada grupo (limitado a `batch_size`):
   - Se `dry_run=false`, executa em transacao (savepoint por grupo):
     - `UPDATE crm_deals SET contact_id = principal WHERE contact_id = secundario`
     - `UPDATE meeting_slot_attendees SET contact_id = principal WHERE contact_id = secundario` (meeting_slot_attendees TEM contact_id)
     - `UPDATE crm_contacts SET merged_into_contact_id = principal, merged_at = NOW(), is_archived = true WHERE id = secundario`
   - Se `dry_run=true`, apenas acumula contagens
   - Em caso de erro, faz rollback do grupo e registra no array de erros
4. Retorna JSON:
```json
{
  "dry_run": true/false,
  "grupos_processados": 50,
  "deals_remapeados": 123,
  "attendees_remapeados": 45,
  "contatos_arquivados": 80,
  "erros": [{ "grupo": "...", "erro": "..." }]
}
```

Nota: `deal_activities` e `attendee_notes` NAO tem coluna `contact_id` -- serao ignorados.

### 3. config.toml
Ja existe entrada `[functions.merge-duplicate-contacts]` com `verify_jwt = false` -- nenhuma alteracao necessaria.

## Arquivos
1. `supabase/migrations/TIMESTAMP_add_merge_columns_to_contacts.sql` (migration)
2. `supabase/functions/merge-duplicate-contacts/index.ts` (nova edge function)

## Seguranca
- Usa `SUPABASE_SERVICE_ROLE_KEY` para bypass RLS
- Funcao exposta sem JWT (ja configurado) -- acessivel apenas por quem conhece a URL
- Transacao por grupo garante atomicidade parcial

