

## Fix: SelectItem com valor vazio no seletor de estágio

### Problema
Na linha 740 de `SpreadsheetCompareDialog.tsx`, o `<SelectItem value="">Primeiro estágio (padrão)</SelectItem>` usa string vazia como value, o que é proibido pelo Radix Select.

### Correção
Trocar `value=""` por `value="__default__"` e ajustar a lógica de envio para tratar `"__default__"` como `undefined` (usar primeiro estágio).

**Arquivo:** `src/components/crm/SpreadsheetCompareDialog.tsx`
- Linha 740: `value=""` → `value="__default__"`
- Estado inicial de `selectedStageId`: `""` → `"__default__"`
- Na lógica de envio: `stage_id: selectedStageId === '__default__' ? undefined : selectedStageId`

