
# Correção: Métricas e Controle de Cliques nas Luas da Home

## Problemas Identificados

### 1. Métricas Incorretas (Incorporador e Consórcio)
O arquivo `useUltrametaByBU.ts` **não foi atualizado** - ainda está usando:
- Período **semanal** (deveria ser mensal)
- Query simples sem **deduplicação** para Incorporador
- Campo `valor_comissao` para Consórcio (deveria ser `valor_credito`)

### 2. Cards Clicáveis para Todos
O componente `BUMoonCard` sempre renderiza como `<Link>`, permitindo que qualquer usuário navegue. A regra correta é:
- **Admin e Manager**: podem clicar e navegar
- **Coordenador e abaixo**: apenas visualizam (cards não clicáveis)

---

## Solução

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useUltrametaByBU.ts` | Corrigir métricas: período mensal + deduplicação + valor_credito |
| `src/components/home/BUMoonCard.tsx` | Adicionar prop `canNavigate` para condicionar clique |
| `src/pages/Home.tsx` | Passar `canNavigate` baseado na role do usuário |

---

## Lógica de Permissão

```text
canNavigate = role === 'admin' || role === 'manager'
```

| Role | Acessa /home | Clica nas Luas |
|------|--------------|----------------|
| Admin | ✅ | ✅ Navega |
| Manager | ✅ | ✅ Navega |
| Coordenador | ✅ | ❌ Apenas vê |
| Closer | ✅ | ❌ Apenas vê |
| SDR | ✅ | ❌ Apenas vê |
| Viewer/Outros | ✅ | ❌ Apenas vê |

---

## Correção das Métricas

### Incorporador (Bruto Mensal)
1. Usar RPC `get_first_transaction_ids` para obter IDs de primeira compra
2. Usar RPC `get_all_hubla_transactions` com período mensal
3. Aplicar `getDeduplicatedGross()` para cada transação

### Consórcio (Total em Cartas)
1. Buscar `consortium_cards` do mês atual
2. Somar campo `valor_credito` (não `valor_comissao`)

### Metas Padrão Atualizadas
```text
ultrameta_incorporador: 2.500.000 (2.5M)
ultrameta_consorcio: 15.000.000 (15M em cartas)
ultrameta_credito: 500.000
ultrameta_leilao: 200.000
```

---

## Seção Técnica

### 1. useUltrametaByBU.ts - Corrigido

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth } from 'date-fns';
import { getDeduplicatedGross, TransactionForGross } from '@/lib/incorporadorPricing';

const DEFAULT_TARGETS: Record<string, number> = {
  ultrameta_incorporador: 2500000,
  ultrameta_consorcio: 15000000,
  ultrameta_credito: 500000,
  ultrameta_leilao: 200000,
};

const formatDateForQuery = (date: Date, isEndOfDay = false): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const time = isEndOfDay ? '23:59:59' : '00:00:00';
  return `${year}-${month}-${day}T${time}-03:00`;
};

export function useUltrametaByBU() {
  return useQuery({
    queryFn: async () => {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      // 1. Fetch first IDs for deduplication
      const { data: firstIdsData } = await supabase.rpc('get_first_transaction_ids');
      const firstIdSet = new Set((firstIdsData || []).map(r => r.id));

      // 2. Parallel fetches
      const [incorporadorResult, consorcioResult, ...] = await Promise.all([
        supabase.rpc('get_all_hubla_transactions', {
          p_start_date: formatDateForQuery(monthStart),
          p_end_date: formatDateForQuery(monthEnd, true),
          p_limit: 10000,
          p_search: null,
          p_products: null,
        }),
        supabase.from('consortium_cards')
          .select('valor_credito')
          .gte('data_contratacao', monthStart.toISOString().split('T')[0])
          .lte('data_contratacao', monthEnd.toISOString().split('T')[0]),
        // ...targets
      ]);

      // 3. Calculate with deduplication
      const incorporadorValue = incorporadorResult.data?.reduce((sum, t) => {
        const isFirst = firstIdSet.has(t.id);
        return sum + getDeduplicatedGross(t, isFirst);
      }, 0) || 0;

      const consorcioValue = consorcioResult.data?.reduce(
        (sum, row) => sum + (row.valor_credito || 0), 0
      ) || 0;

      // ...return metrics
    },
  });
}
```

### 2. BUMoonCard.tsx - Prop canNavigate

```typescript
interface BUMoonCardProps {
  // ...existing
  canNavigate?: boolean;
}

export function BUMoonCard({ canNavigate = true, ...props }) {
  const content = (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-300",
      canNavigate && "hover:shadow-lg hover:scale-[1.02] cursor-pointer",
      "bg-card border-border/50"
    )}>
      {/* ...existing content */}
    </Card>
  );

  if (canNavigate) {
    return <Link to={href} className="block group">{content}</Link>;
  }
  
  return <div className="block">{content}</div>;
}
```

### 3. Home.tsx - Verificar Role

```typescript
export default function Home() {
  const { role } = useAuth();
  
  // Only admin and manager can navigate to BU dashboards
  const canNavigateToBU = role === 'admin' || role === 'manager';

  return (
    <BUMoonCard
      {...props}
      canNavigate={canNavigateToBU}
    />
  );
}
```

---

## Resultado Esperado

Após a correção:

| Métrica | Valor Atual | Valor Correto |
|---------|-------------|---------------|
| Incorporador | R$ 12k | ~R$ 2.03M (bruto mensal deduplicado) |
| Consórcio | R$ 0 | ~R$ 10-15M (total em cartas) |

| Role | Comportamento |
|------|---------------|
| Admin/Manager | Cards clicáveis com hover |
| Outros | Cards apenas visualização (sem hover/click) |
