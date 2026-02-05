
# Plano: Corrigir Cálculo de % Meta Global para Closers

## Problema Identificado

O cálculo de **% Meta Global** na lista de fechamentos está mostrando valores incorretos para Closers porque:

1. **Edge Function salva `pct_reunioes_agendadas: 0`** para Closers (linha 980) ao invés de salvar `pctContratos`
2. **O `calculateGlobalPct` no Index.tsx** usa campos de SDR que são zerados para Closers

| Campo no DB | SDR usa para | Closer deveria usar para |
|-------------|--------------|--------------------------|
| `pct_reunioes_agendadas` | % Agendamento | % Contratos Pagos |
| `pct_reunioes_realizadas` | % Realizadas | % Realizadas |
| `pct_tentativas` | % Tentativas | 0 (não aplica) |
| `pct_organizacao` | % Organização | % Organização |

## Correções

### 1. Edge Function: Salvar `pct_contratos` no campo `pct_reunioes_agendadas`

**Arquivo**: `supabase/functions/recalculate-sdr-payout/index.ts`

Na linha ~979, alterar:
```typescript
// ANTES
pct_reunioes_agendadas: 0,

// DEPOIS
pct_reunioes_agendadas: pctContratos, // Para Closers, armazena % de Contratos
```

### 2. Index.tsx: Calcular % Meta Global diferenciado por role_type

**Arquivo**: `src/pages/fechamento-sdr/Index.tsx`

Alterar a função `calculateGlobalPct`:

```typescript
const calculateGlobalPct = (payout: NonNullable<typeof payouts>[0]) => {
  const sdrData = payout.sdr as any;
  const isCloser = sdrData?.role_type === 'closer';
  
  let pcts: number[];
  
  if (isCloser) {
    // Para Closers: usar Contratos (armazenado em pct_reunioes_agendadas) e Organização
    pcts = [
      payout.pct_reunioes_agendadas, // % Contratos
      payout.pct_organizacao,        // % Organização
    ].filter((p) => p !== null && p !== undefined) as number[];
  } else {
    // Para SDRs: usar Agendamento, Realizadas, Tentativas, Organização
    pcts = [
      payout.pct_reunioes_agendadas,
      payout.pct_reunioes_realizadas,
      payout.pct_tentativas,
      payout.pct_organizacao,
    ].filter((p) => p !== null) as number[];
  }

  if (pcts.length === 0) return 0;
  return pcts.reduce((a, b) => a + b, 0) / pcts.length;
};
```

### 3. CloserFechamentoView.tsx: Confirmar consistência

O arquivo já usa a lógica correta (linhas 26-36), mas vamos garantir que está pegando os campos certos:

```typescript
const calculateGlobalPct = () => {
  const pcts = [
    payout.pct_reunioes_agendadas, // = pct_contratos para Closers
    payout.pct_organizacao,
  ].filter((p) => p !== null && p !== undefined) as number[];

  if (pcts.length === 0) return 0;
  return pcts.reduce((a, b) => a + b, 0) / pcts.length;
};
```

## Fluxo Esperado Após Correção

Para o Closer Julio com:
- Realizadas: 230
- Contratos Pagos: 89
- Meta Contratos: 30% × 230 = 69
- % Contratos: 89/69 = 129%
- Organização: 100%

**% Meta Global = (129% + 100%) / 2 = 114.5%** ✅

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/recalculate-sdr-payout/index.ts` | Salvar `pctContratos` em `pct_reunioes_agendadas` |
| `src/pages/fechamento-sdr/Index.tsx` | Diferenciar cálculo por `role_type` |
| `src/components/fechamento/CloserFechamentoView.tsx` | Verificar consistência (já está ok) |

## Ordem de Implementação

1. Corrigir Edge Function para salvar `pctContratos` no campo correto
2. Atualizar `calculateGlobalPct` no Index.tsx para diferenciar Closers
3. Deploy da Edge Function
4. Recalcular os fechamentos de Closers
