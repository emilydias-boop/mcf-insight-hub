

## Corrigir classificação de Canal no Relatório de Carrinho

### Problema
A classificação de canal está incorreta para vários leads. Comparando com a lista manual do usuário:
- "HUBLA (A010)" deveria ser apenas **A010**
- Leads sem tag/deal que vieram por live aparecem como "—" em vez de **LIVE**
- Leads outside (compra antes da R1) deveriam aparecer como **OUTSIDE**
- "Luiz Guilherme" deveria ser **LANÇAMENTO** (sale_origin = launch ou produto "contrato mcf")
- ANAMNESE já funciona por tag mas precisa de fallback mais robusto

### Correção

**`src/hooks/useCarrinhoAnalysisReport.ts`**:

1. **Adicionar `sale_origin` na query de contratos** (linha 304) para detectar lançamento.

2. **Renomear "HUBLA (A010)" para "A010"** em `classifyChannel` (linha 52) e no fallback (linha 665).

3. **Adicionar lógica de LANÇAMENTO**: Se `sale_origin === 'launch'` ou `product_name` contém "contrato mcf", canal = "LANÇAMENTO".

4. **Usar `isOutside` como canal**: Se o lead é outside (comprou antes da R1), e nenhum outro canal foi detectado por tag, classificar como "OUTSIDE".

5. **Default "LIVE"**: Quando nenhuma classificação é encontrada (sem tags, sem A010, sem outside), usar "LIVE" como default — pois todos os leads neste relatório pagaram contrato, e se não vieram por A010/ANAMNESE/BIO, vieram por LIVE.

6. **Passar `isOutside` e `saleOrigin` para a IIFE do `canalEntrada`** (linha 645):

```typescript
canalEntrada: (() => {
  // Lançamento tem prioridade absoluta
  if (tx.sale_origin === 'launch' || (tx.product_name || '').toLowerCase().includes('contrato mcf')) 
    return 'LANÇAMENTO';
  
  const dealTags = deal?.tags || [];
  const classified = classifyChannel({...});
  if (classified) return classified;
  
  const rawTag = getBestRawTag(dealTags);
  if (rawTag) return rawTag;
  if (deal?.originName) return deal.originName.toUpperCase();
  if (deal?.leadChannel) return deal.leadChannel.toUpperCase();
  
  // Outside = comprou antes da R1
  if (isOutside) return 'OUTSIDE';
  
  // A010
  if (a010Date) return 'A010';
  
  // Default: LIVE (lead pagou contrato sem outra classificação)
  return 'LIVE';
})()
```

7. **Em `classifyChannel`**: Trocar `return 'HUBLA (A010)'` por `return 'A010'`.

**`src/components/relatorios/CarrinhoAnalysisReportPanel.tsx`**:
- Adicionar cores para "LANÇAMENTO" (ex: purple) e "OUTSIDE" (ex: red/orange)
- Atualizar filtro de Canal com os novos valores

### Arquivos alterados
- `src/hooks/useCarrinhoAnalysisReport.ts`
- `src/components/relatorios/CarrinhoAnalysisReportPanel.tsx`

