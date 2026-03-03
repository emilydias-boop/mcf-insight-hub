

## Problema

Dois bugs na edge function `import-spreadsheet-leads`:

1. **Coluna errada**: A query usa `.order('order_index')` mas a coluna real em `crm_stages` é `stage_order`. Isso causa o erro `"Could not find stages for this pipeline"` porque o Supabase retorna erro na query.

2. **Payload de 22K leads**: Enviar 22.000 leads de uma vez pode causar timeout na edge function (processamento sequencial). Precisamos enviar em batches pelo client.

## Mudanças

### 1. `supabase/functions/import-spreadsheet-leads/index.ts`
- Corrigir `.order('order_index')` para `.order('stage_order')`

### 2. `src/components/crm/SpreadsheetCompareDialog.tsx`
- Implementar envio em batches (ex: 500 leads por vez) para evitar timeout
- Mostrar progresso: "Processando batch 1/44..."

### 3. `src/hooks/useSpreadsheetCompare.ts`
- Adaptar mutation para aceitar batches e acumular resultados

### Arquivos
- **Modificar** `supabase/functions/import-spreadsheet-leads/index.ts` (fix coluna)
- **Modificar** `src/components/crm/SpreadsheetCompareDialog.tsx` (batching)
- **Modificar** `src/hooks/useSpreadsheetCompare.ts` (batching)

