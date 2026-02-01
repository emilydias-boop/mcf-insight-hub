

# Correção: Métricas Incorretas nas Luas da Página Home

## Problema Identificado

Os valores exibidos nas 4 luas da página `/home` estão incorretos:

| BU | Valor Exibido | Valor Correto | Problema |
|---|---|---|---|
| Incorporador | R$ 12k | ~R$ 2.03M | Usa query simples sem deduplicação, filtra apenas `product_category = 'incorporador'` |
| Consórcio | R$ 0 | ~R$ 10-15M | Busca `valor_comissao` (nulo), deveria ser `valor_credito` |

## Solução

Corrigir o hook `useUltrametaByBU.ts` para:

1. **Incorporador**: Reutilizar a mesma lógica do `useIncorporadorGrossMetrics` - chamar a RPC `get_all_hubla_transactions` com deduplicação correta usando `getDeduplicatedGross`

2. **Consórcio**: Buscar `valor_credito` (total em cartas de crédito vendidas) ao invés de `valor_comissao`

3. **Período**: Usar período MENSAL (não semanal) para ambas as métricas

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/hooks/useUltrametaByBU.ts` | **Modificar** - Corrigir queries e lógica de cálculo |

---

## Lógica Corrigida

### Incorporador (Bruto Mensal)

Reutilizar a mesma lógica já validada do `useIncorporadorGrossMetrics`:

```text
1. Buscar todos os hubla_id "primeiros" via RPC get_first_transaction_ids
2. Buscar transações do mês via RPC get_all_hubla_transactions
3. Para cada transação, aplicar getDeduplicatedGross(tx, isFirstOfGroup)
4. Somar todos os valores brutos
```

### Consórcio (Total em Cartas)

```text
1. Buscar consortium_cards do mês atual
2. Somar campo valor_credito (não valor_comissao)
```

---

## Resultado Esperado

Após a correção:

| BU | Métrica | Fonte |
|---|---|---|
| Incorporador | Bruto Mensal (~2M) | `get_all_hubla_transactions` + deduplicação |
| Consórcio | Total em Cartas (~10-15M) | `consortium_cards.valor_credito` |
| Crédito | 0 (a configurar) | Placeholder |
| Leilão | Bruto Mensal | `hubla_transactions` com `product_category = clube_arremate` |

---

## Seção Técnica

### Código Corrigido do Hook

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth } from 'date-fns';
import { getDeduplicatedGross, TransactionForGross } from '@/lib/incorporadorPricing';

const formatDateForQuery = (date: Date, isEndOfDay = false): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const time = isEndOfDay ? '23:59:59' : '00:00:00';
  return `${year}-${month}-${day}T${time}-03:00`;
};

export function useUltrametaByBU() {
  return useQuery({
    queryKey: ['ultrameta-by-bu'],
    queryFn: async (): Promise<BUMetrics[]> => {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      // 1. Buscar IDs das primeiras transações para deduplicação
      const { data: firstIdsData } = await supabase.rpc('get_first_transaction_ids');
      const firstIdSet = new Set((firstIdsData || []).map((r: { id: string }) => r.id));

      // 2. Buscar dados em paralelo
      const [incorporadorResult, consorcioResult, leilaoResult, targetsResult] = await Promise.all([
        // Incorporador: via RPC com deduplicação
        supabase.rpc('get_all_hubla_transactions', {
          p_search: null,
          p_start_date: formatDateForQuery(monthStart),
          p_end_date: formatDateForQuery(monthEnd, true),
          p_limit: 5000,
          p_products: null,
        }),

        // Consórcio: valor_credito (não valor_comissao)
        supabase
          .from('consortium_cards')
          .select('valor_credito')
          .gte('data_contratacao', monthStart.toISOString().split('T')[0])
          .lte('data_contratacao', monthEnd.toISOString().split('T')[0]),

        // Leilão: manter lógica similar
        supabase
          .from('hubla_transactions')
          .select('net_value, product_price, gross_override')
          .eq('product_category', 'clube_arremate')
          .gte('sale_date', formatDateForQuery(monthStart))
          .lte('sale_date', formatDateForQuery(monthEnd, true)),

        // Targets
        supabase
          .from('team_targets')
          .select('target_type, target_value')
          .in('target_type', ['ultrameta_incorporador', 'ultrameta_consorcio', 'ultrameta_credito', 'ultrameta_leilao']),
      ]);

      // 3. Calcular Incorporador com deduplicação
      const incorporadorValue = (incorporadorResult.data || []).reduce(
        (sum: number, t: TransactionForGross & { id: string }) => {
          const isFirst = firstIdSet.has(t.id);
          return sum + getDeduplicatedGross(t, isFirst);
        }, 0);

      // 4. Calcular Consórcio (valor_credito)
      const consorcioValue = (consorcioResult.data || []).reduce(
        (sum, row) => sum + (row.valor_credito || 0), 0);

      // 5. Calcular Leilão
      const leilaoValue = calcGrossValue(leilaoResult.data);

      // ...resto igual
    },
  });
}
```

### Alterações na Meta Padrão

Ajustar metas padrão para refletir valores mensais:

```typescript
const DEFAULT_TARGETS: Record<string, number> = {
  ultrameta_incorporador: 2500000,   // 2.5M meta mensal
  ultrameta_consorcio: 15000000,     // 15M em cartas
  ultrameta_credito: 500000,         // 500k placeholder
  ultrameta_leilao: 200000,          // 200k placeholder
};
```

