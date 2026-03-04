

## Problema

O indicador "Contratos Pagos" mostra **Realizado: 0** para SDRs porque a Edge Function `recalculate-sdr-payout` ignora o campo `contratos` retornado pela RPC `get_sdr_metrics_from_agenda`. A RPC já calcula corretamente os contratos (por `contract_paid_at`), mas o resultado nunca é usado.

**Linha 580-583** da Edge Function (SDR path):
```typescript
reunioesAgendadas = metrics.agendamentos || 0;
reunioesRealizadas = metrics.r1_realizada || 0;
noShows = Math.max(0, reunioesAgendadas - reunioesRealizadas);
// ← metrics.contratos é IGNORADO
```

**Linha 903** (criação do KPI):
```typescript
intermediacoes_contrato: isCloser ? contratosPagos : 0  // ← hardcoded 0 para SDR
```

## Correção

### 1. Edge Function `recalculate-sdr-payout/index.ts`

Na seção SDR (linhas 580-583), ler `metrics.contratos`:
```typescript
reunioesAgendadas = metrics.agendamentos || 0;
reunioesRealizadas = metrics.r1_realizada || 0;
noShows = Math.max(0, reunioesAgendadas - reunioesRealizadas);
contratosPagos = metrics.contratos || 0;  // ← NOVO: usar contratos da RPC
```

Na criação do KPI (linha 903), usar `contratosPagos` para ambos:
```typescript
intermediacoes_contrato: contratosPagos,  // ← funciona para SDR e Closer
```

Na atualização do KPI existente (seção updateFields ~linha 854), também atualizar `intermediacoes_contrato` para Closers e SDRs com dados da agenda.

### 2. Manter fallback de `sdr_intermediacoes`

O bloco que conta `sdr_intermediacoes` (linhas 929-941) será mantido, mas com lógica: se `contratosPagos > 0` (veio da agenda), usar esse valor; caso contrário, usar `sdr_intermediacoes` como fallback (para SDRs que registram intermediações manualmente).

### Resultado

O indicador "Contratos Pagos" para SDRs refletirá automaticamente os contratos pagos das R1s que o SDR agendou, sem necessidade de registro manual.

