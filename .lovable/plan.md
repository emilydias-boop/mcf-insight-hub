

## Normalizar Canal para apenas os 6 valores válidos

### Problema
O `classifyChannel` retorna muitos valores intermediários (BASE CLINT, HUBLA, BIO-INSTAGRAM, DUPLICADO-LIMBO, CSV, WEBHOOK, LEAD-FORM, A010 (MAKE), etc.) que não deveriam aparecer no relatório. O usuário quer apenas: **A010, LIVE, ANAMNESE, ANAMNESE-INSTA, OUTSIDE, LANÇAMENTO**.

### Correção

**`src/hooks/useCarrinhoAnalysisReport.ts`** — Adicionar uma função de normalização e aplicá-la ao resultado do `canalEntrada`:

```typescript
const VALID_CHANNELS = new Set(['A010', 'LIVE', 'ANAMNESE', 'ANAMNESE-INSTA', 'OUTSIDE', 'LANÇAMENTO']);

function normalizeChannel(raw: string): string {
  if (VALID_CHANNELS.has(raw)) return raw;
  // Map known variants to valid channels
  const upper = raw.toUpperCase();
  if (upper.includes('ANAMNESE-INSTA') || upper.includes('ANAMNESE INSTA')) return 'ANAMNESE-INSTA';
  if (upper.includes('ANAMNESE')) return 'ANAMNESE';
  if (upper.includes('A010')) return 'A010';  // covers "A010 (MAKE)", "HUBLA (A010)", etc.
  if (upper.includes('LANÇAMENTO') || upper.includes('LANCAMENTO')) return 'LANÇAMENTO';
  // Everything else (BASE CLINT, HUBLA, BIO-INSTAGRAM, DUPLICADO-LIMBO, CSV, WEBHOOK, LEAD-FORM, etc.) → LIVE
  return 'LIVE';
}
```

Aplicar no IIFE do `canalEntrada` (linha ~810), envolvendo o resultado:
```typescript
canalEntrada: normalizeChannel((() => {
  // ... lógica existente ...
})()),
```

Também atualizar o filtro de Canal no painel (`CarrinhoAnalysisReportPanel.tsx`) para listar apenas esses 6 valores.

### Arquivos alterados
- `src/hooks/useCarrinhoAnalysisReport.ts` (adicionar `normalizeChannel`, aplicar no IIFE)
- `src/components/relatorios/CarrinhoAnalysisReportPanel.tsx` (filtro de Canal com valores fixos)

