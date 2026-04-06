
# Ocultar "Intermediações de Contrato" para Consórcio

## Problema

A seção "Intermediações de Contrato" aparece para todos os SDRs no fechamento, inclusive os de Consórcio. Consórcio não utiliza contratos Hubla — a métrica relevante é "Proposta Fechada", não "Contrato Pago". Portanto essa seção não faz sentido para eles.

## Solução

### Arquivo: `src/pages/fechamento-sdr/Detail.tsx`

A página já lê `fromBu = searchParams.get('bu')` da URL. Basta condicionar a renderização do `IntermediacoesList`:

```tsx
// Linha ~563-564: adicionar condição
{fromBu !== 'consorcio' && (
  <IntermediacoesList sdrId={payout.sdr_id} anoMes={payout.ano_mes} disabled={!canEdit} isCloser={isCloser} />
)}
```

Isso remove a seção inteira (título + lista + botão adicionar) quando o SDR é de Consórcio.

## Resultado esperado
- SDRs de Consórcio: seção "Intermediações de Contrato" não aparece
- SDRs de Incorporador: comportamento inalterado
