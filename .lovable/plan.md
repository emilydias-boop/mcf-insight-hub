

# Plano: Remover Outside da Taxa de Conversao dos Closers

## Problema Atual

A Taxa de Conversao inclui **Outside** no calculo:
- Formula atual: `(Contrato Pago + Outside) / R1 Realizada × 100`
- Problema: Outside sao vendas que ocorreram ANTES da reuniao - o closer nao converteu essas vendas

## Solucao

Ajustar a formula para usar apenas contratos genuinamente convertidos pelo closer:
- Nova formula: `Contrato Pago / R1 Realizada × 100`

---

## Arquivos a Modificar

### 1. `src/hooks/useCloserDetailData.ts`

**Linha 288** - Media da equipe:
```typescript
// DE:
avgTaxaConversao: avgR1Realizada > 0 ? ((avgContratoPago + avgOutside) / avgR1Realizada) * 100 : 0,

// PARA:
avgTaxaConversao: avgR1Realizada > 0 ? (avgContratoPago / avgR1Realizada) * 100 : 0,
```

**Linha 306** - Calculo individual para ranking:
```typescript
// DE:
taxaConversao: c.r1_realizada > 0 ? ((c.contrato_pago + c.outside) / c.r1_realizada) * 100 : 0,

// PARA:
taxaConversao: c.r1_realizada > 0 ? (c.contrato_pago / c.r1_realizada) * 100 : 0,
```

### 2. `src/components/closer/CloserDetailKPICards.tsx`

**Linhas 101-103** - KPI Card individual:
```typescript
// DE:
const taxaConversao = m.r1_realizada > 0 
  ? ((m.contrato_pago + m.outside) / m.r1_realizada) * 100 
  : 0;

// PARA:
const taxaConversao = m.r1_realizada > 0 
  ? (m.contrato_pago / m.r1_realizada) * 100 
  : 0;
```

---

## Impacto

| Metrica | Antes | Depois |
|---------|-------|--------|
| Taxa Conversao | (CP + Outside) / Realizada | CP / Realizada |
| Contrato Pago | Sem alteracao | Sem alteracao |
| Outside | Continua sendo exibido separadamente | Continua sendo exibido separadamente |

O **Outside** continuara visivel como metrica separada, mas nao inflara artificialmente a taxa de conversao do closer.

---

## Secao Tecnica

### Arquivos Afetados
- `src/hooks/useCloserDetailData.ts` (2 alteracoes)
- `src/components/closer/CloserDetailKPICards.tsx` (1 alteracao)

### Escopo das Alteracoes
- Hook de dados: calculo de media da equipe e ranking
- Componente KPI: calculo local para exibicao

### Verificacao
Apos implementar, a taxa de conversao deve diminuir para closers que tinham Outsides, refletindo apenas as vendas genuinamente convertidas.

