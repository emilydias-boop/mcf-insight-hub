

# Corrigir cálculo de datas na recalculação de parcelas

## Problema

Dois bugs na recalculação de datas de parcelas do consórcio:

1. **Timezone**: `dataVencimento.toISOString().split('T')[0]` converte para UTC, deslocando a data em -1 dia (meia-noite BRT = 21h UTC do dia anterior). Resultado: 20/05 vira 19/05.

2. **Offset errado**: Em `recalcularDatasAPartirDe`, o offset da primeira parcela recalculada começa em 0, fazendo ela cair no **mesmo mês** da data base. A parcela seguinte deveria ser 1 mês depois.

## Solução

| Arquivo | Alteração |
|---|---|
| `src/lib/businessDays.ts` | Corrigir offset: `offset = i - parcelaInicial + 1` para que a próxima parcela caia 1 mês depois da data editada |
| `src/components/consorcio/ConsorcioCardDrawer.tsx` | Usar `format(dataVencimento, 'yyyy-MM-dd')` do date-fns em vez de `toISOString().split('T')[0]` para evitar shift de timezone |

### Correção 1 - Offset (`businessDays.ts` linha 190)

```typescript
// ANTES:
const offset = i - parcelaInicial; // parcela seguinte = offset 0 = mesmo mês (ERRADO)

// DEPOIS:
const offset = i - parcelaInicial + 1; // parcela seguinte = offset 1 = próximo mês (CORRETO)
```

### Correção 2 - Timezone (`ConsorcioCardDrawer.tsx` linha 203)

```typescript
// ANTES:
.update({ data_vencimento: dataVencimento.toISOString().split('T')[0] })

// DEPOIS:
.update({ data_vencimento: format(dataVencimento, 'yyyy-MM-dd') })
```

Com essas duas correções:
- Parcela 1 editada para 20/05/2026 → salva como 20/05/2026 (sem shift)
- Parcela 2 recalculada → 22/06/2026 (próximo mês, dia útil)
- Parcela 3 → 22/07/2026, etc.

