

## Problema: Tags não aplicadas aos deals `found_in_current` + necessidade de reimportação

### Diagnóstico

Há **dois problemas** na última importação:

1. **Tags não foram aplicadas para `found_in_current` (35 deals)**: O código atualiza `stage_id` (linha 373-382) mas **não inclui `tags`** no update. O `bulkTransfer` também só muda `owner_id`/`owner_profile_id`, ignorando tags completamente.

2. **Profile IDs errados na importação anterior**: A correção dos profile IDs reais só foi aplicada agora. A importação anterior usou `sdr.id` incorretos, então os owners estão errados.

**Sim, será necessário reimportar** para corrigir os owners (profile IDs) e aplicar as tags corretamente.

### Correção antes de reimportar

**Arquivo: `src/components/crm/SpreadsheetCompareDialog.tsx`**

No bloco de update de `found_in_current` (linhas 373-382), adicionar `tags` ao update:

```typescript
// Antes (só stage):
.update({ stage_id: stageId })

// Depois (stage + tags):
const updateData: any = {};
if (stageId) updateData.stage_id = stageId;
if (tags?.length) updateData.tags = [...new Set(['base clint', ...tags])];

if (Object.keys(updateData).length > 0) {
  await supabase.from('crm_deals')
    .update(updateData)
    .in('id', allDealIds);
}
```

Isso garante que, ao reimportar, tanto o estágio quanto a tag "LEAD-SCORE" serão aplicados a todos os deals — inclusive os que já existiam na pipeline.

### Arquivo modificado
- `src/components/crm/SpreadsheetCompareDialog.tsx` — incluir tags no update de deals `found_in_current`

