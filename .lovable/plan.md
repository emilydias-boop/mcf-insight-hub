

## Remover coluna A010 e corrigir classificação de Canal (ANAMNESE vs LIVE)

### Problema

1. **Coluna A010 redundante** — o canal já indica se veio pela Hubla (A010) ou por ANAMNESE.
2. **Classificação errada de canal** — Leads como Thalita que têm tag ANAMNESE no CRM mas `lead_channel = LIVE` aparecem como "LIVE" em vez de "ANAMNESE". A função `classifyChannel` prioriza `lead_channel` sobre tags, mas a tag ANAMNESE é mais relevante para o operacional.

### Solução

**`src/hooks/useCarrinhoAnalysisReport.ts`** — Inverter prioridade no `classifyChannel`: checar tags ANAMNESE **antes** de `lead_channel`:

```typescript
function classifyChannel(leadChannel, dataSource, tags, hasA010) {
  // Tags têm prioridade para ANAMNESE (mais confiável)
  if (tags.some(t => t.toUpperCase().includes('ANAMNESE-INSTA'))) return 'ANAMNESE-INSTA';
  if (tags.some(t => t.toUpperCase().includes('ANAMNESE'))) return 'ANAMNESE';
  
  // Depois checar lead_channel
  const lc = (leadChannel || '').toUpperCase();
  if (lc.includes('ANAMNESE-INSTA')) return 'ANAMNESE-INSTA';
  if (lc.includes('ANAMNESE')) return 'ANAMNESE';
  if (lc.includes('LIVE')) return 'LIVE';
  if (lc.includes('LEAD-FORM')) return 'LEAD-FORM';
  if (lc.includes('CLIENTDATA')) return 'CLIENTDATA';
  if (lc) return lc;
  
  if (dataSource === 'webhook') return 'WEBHOOK';
  if (dataSource === 'csv') return 'CSV';
  if (hasA010) return 'HUBLA (A010)';
  return '';
}
```

**`src/components/relatorios/CarrinhoAnalysisReportPanel.tsx`**:
- Remover coluna "A010" (header + cell) da tabela e do export Excel
- Manter apenas a coluna "Canal"

### Resultado
- Thalita (LIVE + ANAMNESE tag) aparece como **ANAMNESE** em vez de LIVE
- Coluna A010 removida, canal centraliza a informação de origem
- Leads sem tag ANAMNESE mas com `lead_channel=LIVE` continuam como LIVE

### Arquivos alterados
- `src/hooks/useCarrinhoAnalysisReport.ts`
- `src/components/relatorios/CarrinhoAnalysisReportPanel.tsx`

