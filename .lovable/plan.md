
# Plano: Remover Outside da Taxa de Conversao - Correcao Completa

## Problema

A alteracao anterior foi aplicada apenas em 2 arquivos, mas existem outros locais que ainda calculam a Taxa de Conversao incluindo Outside:

| Arquivo | Linha | Status |
|---------|-------|--------|
| `useCloserDetailData.ts` | 288, 306 | Corrigido |
| `CloserDetailKPICards.tsx` | 101 | Corrigido |
| `CloserSummaryTable.tsx` | 56-57, 85-86 | Pendente |
| `CloserMeetingsDetailPage.tsx` | 147 | Pendente |

---

## Arquivos a Modificar

### 1. `src/components/sdr/CloserSummaryTable.tsx`

Este e o componente da **tabela de closers no Painel Comercial** - onde voce viu a discrepancia.

**Linha 55-58** - Total da tabela:
```typescript
// DE:
const totalTaxaConversao = totals.r1_realizada > 0 
  ? (((totals.contrato_pago + totals.outside) / totals.r1_realizada) * 100)
  : 0;

// PARA:
const totalTaxaConversao = totals.r1_realizada > 0 
  ? ((totals.contrato_pago / totals.r1_realizada) * 100)
  : 0;
```

**Linha 84-87** - Por linha (cada closer):
```typescript
// DE:
const taxaConversao = row.r1_realizada > 0 
  ? (((row.contrato_pago + row.outside) / row.r1_realizada) * 100)
  : 0;

// PARA:
const taxaConversao = row.r1_realizada > 0 
  ? ((row.contrato_pago / row.r1_realizada) * 100)
  : 0;
```

---

### 2. `src/pages/crm/CloserMeetingsDetailPage.tsx`

Este e o **card de Resumo do Periodo** na pagina de detalhe do closer.

**Linha 145-148**:
```typescript
// DE:
{closerMetrics?.r1_realizada && closerMetrics.r1_realizada > 0
  ? (((closerMetrics.contrato_pago + closerMetrics.outside) / closerMetrics.r1_realizada) * 100).toFixed(1)
  : '0.0'}%

// PARA:
{closerMetrics?.r1_realizada && closerMetrics.r1_realizada > 0
  ? ((closerMetrics.contrato_pago / closerMetrics.r1_realizada) * 100).toFixed(1)
  : '0.0'}%
```

---

## Resumo das Alteracoes

| Local | Tipo | Impacto |
|-------|------|---------|
| Tabela Closers (total) | Calculo | Linha "Total" na tabela |
| Tabela Closers (por linha) | Calculo | Cada closer na tabela |
| Detalhe Closer (resumo) | Exibicao | Card "Taxa de Conversao" |

---

## Resultado Esperado

Apos implementar:
- **Taxa de Conversao** = `Contrato Pago / R1 Realizada x 100`
- **Outside** continua visivel como coluna separada
- Consistencia em todos os periodos (Dia, Semana, Mes)

---

## Secao Tecnica

### Arquivos Afetados
- `src/components/sdr/CloserSummaryTable.tsx` (2 alteracoes)
- `src/pages/crm/CloserMeetingsDetailPage.tsx` (1 alteracao)

### Formula Final
```
Taxa Conversao = (Contrato Pago / R1 Realizada) × 100
```

A metrica Outside permanece como informacao complementar, sem impactar a taxa de conversao oficial do closer.
