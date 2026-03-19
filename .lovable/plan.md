

## Plano: Corrigir cálculo de datas de vencimento das parcelas no sync

### Problema
Para Maria da Gloria (e potencialmente muitos outros), o sync gera parcelas com datas erradas porque usa a data da **primeira transação encontrada** (que pode ser parcela 5 ou 7) como base para calcular todas as datas de vencimento.

Exemplo concreto:
- Hubla tem parcelas 5/10 (paga em 04/01) e 7/10 (paga em 04/03)
- O sync usa 04/01 como `firstDate` e gera parcela 1 com vencimento 04/01 — mesmo dia da parcela 5
- Resultado: parcelas 1 e 5 aparecem ambas em 04/01, parcelas 2 e 7 ambas em 04/03

### Causa raiz
Linha 269: `const firstDate = new Date(first.sale_date)` — pega a data da primeira transação na lista, que é a parcela 5 (não a parcela 1). O cálculo de vencimentos deveria **retroceder** a partir dos dados conhecidos para estimar a data da parcela 1.

### Solução

**Arquivo: `supabase/functions/sync-billing-from-hubla/index.ts`**

Em vez de usar `first.sale_date` diretamente como base, calcular a data estimada da parcela 1 **retrocedendo** a partir de uma parcela paga conhecida:

```text
Antes:
  firstDate = first.sale_date  // ex: 2026-01-05 (parcela 5)
  dueDate(i) = firstDate + interval * (i - 1)
  → Parcela 1 = 04/01, Parcela 5 = 04/01 + 4*intervalo ≠ 04/01

Depois:
  // Pegar a transação com menor installment_number conhecida
  knownTx = transação com installment_number mais baixo
  estimatedFirstDate = knownTx.sale_date - (knownTx.installment_number - 1) * interval
  dueDate(i) = estimatedFirstDate + interval * (i - 1)
  → Parcela 1 = ~05/09/2025, Parcela 5 = ~05/01/2026 ✓
```

Isso corrige as datas de vencimento para refletir a linha temporal real da assinatura. As parcelas 1-4 terão datas no passado (antes da primeira transação conhecida), e as parcelas 5+ terão datas alinhadas com os pagamentos reais.

### Mudança adicional: Recalcular parcelas existentes
Como as parcelas já foram criadas com datas erradas, o sync precisa também **atualizar a data de vencimento** de parcelas existentes que não estão pagas, quando a data calculada difere da armazenada.

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/sync-billing-from-hubla/index.ts` | Calcular `firstDate` retroativamente a partir do `installment_number` conhecido; atualizar datas de parcelas pendentes existentes |

### Após deploy
Rodar "Sincronizar Hubla" uma vez para recalcular todas as datas. As parcelas da Maria da Gloria passarão a ter datas corretas e sem "duplicatas" visuais.

