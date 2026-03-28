

## Fix: Canal de Entrada não detecta ANAMNESE e outros canais corretamente

### Causa raiz

1. **`lead_channel` está NULL para quase todos os leads** — apenas 5 de ~100 deals têm `lead_channel` preenchido. O campo não é confiável.
2. **Tags são a fonte real**: `[ANAMNESE]`, `[A010]`, `[A010 Make]`, `[BIO-Instagram]`, `[ob-construir-alugar Hubla]`, `[base clint]`.
3. **Múltiplos deals por contato**: O código faz `dealMap.set(contact_id, ...)` e sobrescreve — se o primeiro deal não tem tags mas o segundo tem `[ANAMNESE]`, perde a informação.
4. Quando lead_channel existe, tem valor errado (`CLIENTDATA-INSIDE` para leads que são `ANAMNESE`).

### Solução

**`src/hooks/useCarrinhoAnalysisReport.ts`**:

1. **Ao popular o `dealMap`, preferir o deal com tags mais informativas**. Se já existe um deal mapeado, só substituir se o novo tiver tags melhores (ANAMNESE, A010, etc.)

2. **Reescrever `classifyChannel` para priorizar tags completamente** e ignorar `lead_channel`:

```typescript
function classifyChannel(tags: string[], dataSource: string | null, hasA010: boolean): string {
  const allTags = tags.map(t => t.toUpperCase());
  
  // ANAMNESE-INSTA primeiro (mais específico)
  if (allTags.some(t => t.includes('ANAMNESE-INSTA') || t.includes('ANAMNESE INSTA'))) return 'ANAMNESE-INSTA';
  if (allTags.some(t => t.includes('ANAMNESE'))) return 'ANAMNESE';
  if (allTags.some(t => t.includes('BIO-INSTAGRAM') || t.includes('BIO INSTAGRAM'))) return 'BIO-INSTAGRAM';
  if (allTags.some(t => t.includes('LEAD-LIVE') || t.includes('LIVE'))) return 'LIVE';
  if (allTags.some(t => t.includes('LEAD-FORM') || t.includes('LEAD FORM'))) return 'LEAD-FORM';
  if (allTags.some(t => t.includes('A010') && t.includes('MAKE'))) return 'A010 (MAKE)';
  if (allTags.some(t => t === 'A010' || t.startsWith('A010 '))) return 'A010';
  if (allTags.some(t => t.includes('HUBLA'))) return 'HUBLA';
  if (allTags.some(t => t.includes('BASE CLINT'))) return 'BASE CLINT';
  
  // Fallback para data_source
  if (dataSource === 'csv') return 'CSV';
  if (hasA010) return 'HUBLA (A010)';
  if (dataSource === 'webhook') return 'WEBHOOK';
  return '';
}
```

3. **Ao popular `dealMap`**: agregar tags de TODOS os deals do mesmo contato, em vez de sobrescrever:

```typescript
// Se já existe, mesclar tags
if (dealMap.has(d.contact_id)) {
  const existing = dealMap.get(d.contact_id)!;
  const mergedTags = [...new Set([...existing.tags, ...(d.tags || [])])];
  existing.tags = mergedTags;
  if (!existing.sdrName && sdrName) existing.sdrName = sdrName;
} else {
  dealMap.set(d.contact_id, { id: d.id, sdrName, tags });
}
```

4. Remover `leadChannel` e `dataSource` como campos separados do dealMap — simplificar para `tags` + `dataSource` (manter data_source apenas como fallback).

5. Mesmo tratamento no bloco de fallback por telefone (linhas ~380-400).

**`src/components/relatorios/CarrinhoAnalysisReportPanel.tsx`**:
- Adicionar cores para novos canais: `A010` → amber, `A010 (MAKE)` → amber, `BASE CLINT` → slate, `BIO-INSTAGRAM` → pink, `WEBHOOK` → gray
- Atualizar filtro de Canal para incluir os novos valores

### Arquivos alterados
- `src/hooks/useCarrinhoAnalysisReport.ts`
- `src/components/relatorios/CarrinhoAnalysisReportPanel.tsx`

