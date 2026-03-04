

## Problema

O campo "Intermediações de Contrato" no formulário "Editar KPIs" mostra `0` para SDRs porque lê da tabela `sdr_intermediacoes` (registros manuais), enquanto o indicador "Contratos Pagos" abaixo mostra `13` porque lê do campo `intermediacoes_contrato` do KPI (preenchido automaticamente pela agenda).

**Código atual (Detail.tsx, linha 313-315):**
```typescript
const effectiveIntermediacao = isCloser && closerMetrics.data 
  ? closerMetrics.data.contratos_pagos 
  : intermediacaoCount;  // ← conta sdr_intermediacoes (manual) = 0
```

## Correção

Alterar a lógica para SDRs: priorizar o valor de `effectiveKpi?.intermediacoes_contrato` (que já é preenchido automaticamente pela Edge Function) e usar `intermediacaoCount` apenas como fallback.

**Novo código:**
```typescript
const effectiveIntermediacao = isCloser && closerMetrics.data 
  ? closerMetrics.data.contratos_pagos 
  : (effectiveKpi?.intermediacoes_contrato || intermediacaoCount);
```

Arquivo: `src/pages/fechamento-sdr/Detail.tsx` — alterar 1 linha.

