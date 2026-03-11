

## Diagnóstico do Problema

O toast mostrou "0 transferidos, 0 criados, 109 já existiam" — os leads não foram para o estágio "LEAD SCORE" porque:

1. **`found_in_current` (35 leads)**: O `bulkTransfer` só atualiza `owner_id`/`owner_profile_id`, mas **não muda o `stage_id`**. Mesmo selecionando "LEAD SCORE", os deals ficam no estágio anterior.

2. **`found_elsewhere` (98 leads)**: A edge function encontrou que esses contatos **já tinham deal nesta pipeline** e simplesmente fez `skipped++` sem atualizar nada (stage, owner, tags).

3. **`not_found` (11 leads)**: Mesmo caso — o contato foi encontrado por deduplicação (email/phone), já tinha deal nesta origin, e foi skipped.

### Solução

#### 1. Edge Function `import-spreadsheet-leads` — Atualizar deals existentes em vez de pular

Quando `existingDeal` é encontrado (linha 137), em vez de apenas `skipped++`, **atualizar stage_id, owner e tags** do deal existente. Adicionar um contador `updated` no retorno.

```text
Antes:  if (existingDeal?.length) { skipped++; continue; }
Depois: if (existingDeal?.length) { UPDATE stage/owner/tags → updated++; continue; }
```

#### 2. `bulkTransfer` no `handleSmartImport` — Também mudar stage

Para `found_in_current`, após o `bulkTransfer` (que muda owner), fazer um update em batch do `stage_id` quando o usuário selecionou um estágio específico.

**Arquivo: `src/components/crm/SpreadsheetCompareDialog.tsx`** — Após o bulkTransfer dos `inCurrent`, se `stageId` definido, fazer `supabase.from('crm_deals').update({ stage_id: stageId }).in('id', dealIds)`.

#### 3. Retorno da edge function — Incluir `updated`

Atualizar o toast para mostrar: "X transferidos, Y criados, Z atualizados, W já estavam corretos".

### Arquivos modificados
- `supabase/functions/import-spreadsheet-leads/index.ts` — update em vez de skip
- `src/components/crm/SpreadsheetCompareDialog.tsx` — stage update para `found_in_current` + toast com `updated`

