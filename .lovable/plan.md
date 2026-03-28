

## Adicionar coluna "Canal de Entrada" no Relatório de Análise de Carrinho

### O que será feito

Adicionar uma coluna **"Canal"** na tabela detalhada que mostra como o lead chegou — se foi por A010, Anamnese, Live, ClientData, etc. A informação vem do `crm_deals.custom_fields->>'lead_channel'` e `crm_deals.data_source`.

### Dados disponíveis

Na tabela `crm_deals`:
- `custom_fields->>'lead_channel'`: ANAMNESE-INSTA-MCF, CLIENTDATA-INSIDE, LIVE, LEAD-FORM-50K, etc.
- `data_source`: webhook, csv, bubble, replication
- `tags`: array com tags como "A010 - Construa para Vend", "ANAMNESE", "base clint", etc.

A prioridade será: `lead_channel` (mais preciso) → fallback para `data_source`.

### Alterações

**`src/hooks/useCarrinhoAnalysisReport.ts`**:
1. Na interface `LeadCarrinhoCompleto`, adicionar `canalEntrada: string | null`
2. Na query de deals (linha 210), adicionar `custom_fields, data_source` ao select
3. No `dealMap`, guardar `leadChannel` e `dataSource` extraídos do deal
4. No loop de montagem dos leads (linha 470+), popular `canalEntrada` com `deal.leadChannel || deal.dataSource || null`

**`src/components/relatorios/CarrinhoAnalysisReportPanel.tsx`**:
1. Adicionar coluna "Canal" na tabela, entre "SDR" e "Class."
2. Renderizar com badge colorida (ex: ANAMNESE = roxo, A010 = verde, LIVE = azul, CLIENTDATA = cinza)
3. Adicionar filtro dropdown "Canal: Todos" na barra de filtros

### Detalhes técnicos

```typescript
// No dealMap, guardar canal
dealMap.set(d.contact_id, {
  id: d.id,
  sdrName: (d as any).owner?.name || null,
  leadChannel: (d as any).custom_fields?.lead_channel || null,
  dataSource: d.data_source || null,
});

// No lead
canalEntrada: deal?.leadChannel || deal?.dataSource || null
```

