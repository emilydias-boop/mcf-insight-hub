

## Melhorar coluna "Canal" — distinguir ANAMNESE / ANAMNESE-INSTA / HUBLA (A010)

### Problema atual

A coluna "Canal" mostra `lead_channel` bruto (ex: `ANAMNESE-INSTA-MCF`, `CLIENTDATA-INSIDE`) ou `data_source` (`webhook`, `csv`). Isso não é claro o suficiente — o usuário quer saber de forma simples:
- **ANAMNESE** — lead entrou pelo webhook de anamnese
- **ANAMNESE-INSTA** — lead entrou pelo webhook de anamnese Instagram
- **HUBLA / A010** — lead entrou pela compra direta do A010 na Hubla
- **LIVE** — lead veio de live
- **CLIENTDATA** — base de clientes
- **LEAD-FORM** — formulário de captação

### Solução

**`src/hooks/useCarrinhoAnalysisReport.ts`** — Criar função `classifyChannel` que normaliza o canal:

```typescript
function classifyChannel(leadChannel: string | null, dataSource: string | null, tags: string[]): string | null {
  const lc = (leadChannel || '').toUpperCase();
  
  if (lc.includes('ANAMNESE-INSTA')) return 'ANAMNESE-INSTA';
  if (lc.includes('ANAMNESE')) return 'ANAMNESE';
  if (lc.includes('LIVE')) return 'LIVE';
  if (lc.includes('LEAD-FORM') || lc.includes('LEADFORM')) return 'LEAD-FORM';
  if (lc.includes('CLIENTDATA')) return 'CLIENTDATA';
  if (lc) return lc; // outro lead_channel específico
  
  // Fallback: sem lead_channel, checar data_source
  if (dataSource === 'webhook') return 'WEBHOOK';
  if (dataSource === 'csv') return 'CSV';
  
  // Fallback: checar tags
  if (tags.some(t => t.toUpperCase().includes('ANAMNESE'))) return 'ANAMNESE';
  
  // Se tem compra A010 na Hubla mas sem deal/webhook → veio direto pela Hubla
  return null;
}
```

- Adicionar `tags` ao select de `crm_deals` (linha 212)
- Guardar `tags` no `dealMap`
- Na montagem do lead: `canalEntrada: classifyChannel(deal?.leadChannel, deal?.dataSource, deal?.tags || [])`
- Se `canalEntrada` ficar null mas o lead tem `dataA010` (compra Hubla), marcar como `'HUBLA (A010)'`

**`src/components/relatorios/CarrinhoAnalysisReportPanel.tsx`** — Atualizar as cores dos badges:
- ANAMNESE → roxo
- ANAMNESE-INSTA → rosa/pink
- HUBLA (A010) → verde
- LIVE → azul
- CLIENTDATA → cinza
- LEAD-FORM → amarelo
- WEBHOOK/CSV → slate

### Arquivos alterados
- `src/hooks/useCarrinhoAnalysisReport.ts`
- `src/components/relatorios/CarrinhoAnalysisReportPanel.tsx`

