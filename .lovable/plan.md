

## Diagnóstico: Números dos Closers no "Meu Desempenho"

### Dados reais do banco (Março 2026)

| Closer | Total Real (sem filtro SDR) | Mostrando (com filtro SDR ativo) | Diferença | Motivo |
|--------|---------------------------|----------------------------------|-----------|--------|
| Mateus Macedo | 227 | 199 | -28 | 28 reuniões da Evellyn (inativa) |
| Julio | 210 | 194 | -16 | 16 reuniões da Evellyn (inativa) |
| Thayna | 204 | 197 | -7 | 6 Evellyn + 1 Hellen (inativas) |
| Cristiane | 199 | 181 | -18 | 16 Evellyn + 2 Hellen (inativas) |

### Problema

O hook `useR1CloserMetrics` (linha 454-457) exclui attendees cujo `booked_by` não pertence a um SDR ativo. A Evellyn agendou 66 reuniões em março antes de ser desativada — todas essas reuniões estão sumindo dos KPIs dos closers.

O Julio mostra R1 Agendada = 194, mas na realidade tem 210 reuniões válidas. O mesmo padrão afeta todos os closers.

### Correção proposta

Remover o filtro de `validSdrEmails` na contagem de métricas dos closers. As reuniões já aconteceram ou foram agendadas — o fato do SDR ter sido desativado depois não invalida as reuniões.

| Arquivo | O que muda |
|---------|-----------|
| `src/hooks/useR1CloserMetrics.ts` | Remover filtro por `validSdrEmails` nas linhas 454-457 (contagem de R1 Agendada, R1 Realizada, No-Show). Manter o filtro apenas para `is_partner = false` |

### Detalhes da mudança

No loop de processamento de meetings (linhas 448-483), remover:
```typescript
const bookedByEmail = att.booked_by ? profileEmailMap.get(att.booked_by) : null;
if (!bookedByEmail || !validSdrEmails.has(bookedByEmail)) {
  return; // REMOVER ESTE FILTRO
}
```

Também remover o mesmo filtro na contagem de contratos pagos (linhas 279-285) e outsides (linhas 376-377).

### Resultado esperado

| Closer | Antes | Depois |
|--------|-------|--------|
| Mateus | 199 | 227 |
| Julio | 194 | 210 |
| Thayna | 197 | 204 |
| Cristiane | 181 | 199 |

Os números passarão a refletir TODAS as reuniões reais, independente do status atual do SDR que agendou.

