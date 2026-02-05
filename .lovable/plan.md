
# Plano: Adicionar Outside ao KPI de Contratos

## Contexto

O card "Contratos" na página de Reuniões de Equipe mostra apenas contratos pagos (vendas após a reunião). O usuário quer que também inclua **Outside** (vendas realizadas ANTES da reunião agendada).

## Solução

Criar um novo hook para calcular "Outside" por SDR (similar ao que já existe para Closers no `useR1CloserMetrics`) e somar esse valor ao total de contratos no TeamKPICards.

---

## Alterações

### 1. Criar Hook: `src/hooks/useSdrOutsideMetrics.ts`

Hook que detecta leads cujo contrato foi pago ANTES da reunião R1 agendada, agrupando por SDR:

```typescript
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay } from "date-fns";
import { SDR_LIST } from "@/constants/team";

export const useSdrOutsideMetrics = (startDate: Date | null, endDate: Date | null) => {
  return useQuery({
    queryKey: ['sdr-outside-metrics', 
      startDate ? format(startDate, 'yyyy-MM-dd') : null,
      endDate ? format(endDate, 'yyyy-MM-dd') : null
    ],
    queryFn: async () => {
      // 1. Buscar R1 meetings no período
      // 2. Para cada attendee, verificar hubla_transactions com sale_date < scheduled_at
      // 3. Agrupar por booked_by (SDR)
      // 4. Retornar { totalOutside, outsideBySdr }
    },
    enabled: !!startDate && !!endDate,
  });
};
```

### 2. Atualizar Interface: `src/hooks/useTeamMeetingsData.ts`

Adicionar campo `totalOutside` à interface `TeamKPIs`:

```typescript
export interface TeamKPIs {
  sdrCount: number;
  totalAgendamentos: number;
  totalRealizadas: number;
  totalNoShows: number;
  totalContratos: number;
  totalOutside: number;      // NOVO
  taxaConversao: number;
  taxaNoShow: number;
}
```

### 3. Atualizar Cards: `src/components/sdr/TeamKPICards.tsx`

Modificar o card "Contratos" para exibir a soma de contratos + outside:

```typescript
{
  title: "Contratos",
  value: kpis.totalContratos + (kpis.totalOutside || 0),
  icon: FileText,
  color: "text-amber-500",
  bgColor: "bg-amber-500/10",
  tooltip: `Contratos: ${kpis.totalContratos} | Outside: ${kpis.totalOutside || 0}`
}
```

### 4. Integrar na Página: `src/pages/crm/ReunioesEquipe.tsx`

Consumir o novo hook e passar o valor de outside para os KPIs:

```typescript
// Adicionar o hook
const { data: outsideData } = useSdrOutsideMetrics(startDate, endDate);

// Combinar com teamKPIs
const enrichedKPIs = {
  ...teamKPIs,
  totalOutside: outsideData?.totalOutside || 0
};

// Passar para TeamKPICards
<TeamKPICards kpis={enrichedKPIs} ... />
```

---

## Lógica de Detecção Outside (Detalhada)

A lógica já existe no `useR1CloserMetrics` e será replicada para SDRs:

1. Buscar todos os `meeting_slot_attendees` de R1 no período
2. Extrair `deal_id` → buscar email do contato via `crm_deals.contact`
3. Buscar `hubla_transactions` com `product_name ILIKE '%Contrato%'` para esses emails
4. Comparar `sale_date` (transação) com `scheduled_at` (reunião)
5. Se `sale_date < scheduled_at` → é Outside
6. Agrupar contagem por `booked_by` (SDR)

---

## Resultado Esperado

| Card | Antes | Depois |
|------|-------|--------|
| Contratos | 15 | 18 (15 + 3 outside) |

O tooltip mostrará o breakdown: "Contratos: 15 | Outside: 3"
