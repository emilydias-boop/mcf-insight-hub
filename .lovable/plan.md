

## Igualar "R1 Agend." do Funil por Canal à base do Painel (`booked_at`)

### Diagnóstico
O número **806** que ainda aparece está na tabela **"Funil por Canal"** (`/crm/relatorios` ou painel comercial), na coluna **R1 Agend.** — não é mais o card de Reuniões Equipe (que já está em 784).

A divergência vem da RPC `get_channel_funnel_metrics`, que filtra reuniões por `scheduled_at` ("R1 marcada **para** o período" → 806), enquanto o Painel Comercial usa `booked_at` ("R1 marcada **no** período" → 784/799).

### Mudança
Arquivo único: `supabase/migrations/<timestamp>_funnel_metrics_use_booked_at.sql`

Recriar a função `public.get_channel_funnel_metrics` alterando a base temporal de R1 Agendada/Realizada/No-Show:

| Trecho | Antes | Depois |
|---|---|---|
| `dedup_agendada WHERE` | `meeting_day BETWEEN start_date AND end_date` (onde `meeting_day = scheduled_at::date`) | `booked_day BETWEEN start_date AND end_date` (onde `booked_day = COALESCE(booked_at, created_at)::date`) |
| Coluna `meeting_day` em `raw_attendees` | `(ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date` | adicionar `booked_day = (COALESCE(msa.booked_at, msa.created_at) AT TIME ZONE 'America/Sao_Paulo')::date` ao lado |

A deduplicação `LEAST(COUNT(DISTINCT booked_day), 2)` continua igual, garantindo que reagendamentos não inflem.

`contratos_cte` (filtra por `contract_paid_at`) e `entradas_cte` (`created_at`) **não mudam** — já são corretos.

### Resultado esperado (Abril/26, BU Incorporador)
- **Total R1 Agend. (Funil por Canal):** 806 → **~799**
- Diferença residual de ~15 vs Painel (784) vem de regras de cap entre as RPCs e é aceitável — o Funil agrega por canal/deal, o Painel por SDR/booking.
- Conceito alinhado: ambos passam a medir "agendamentos criados no período".

### Atualização de tooltip
Atualizar o tooltip da coluna R1 Agend. em `src/components/relatorios/ChannelFunnelTable.tsx` (linha 90) para refletir a nova base (`booked_at` em vez de `scheduled_at`).

### Escopo
- 1 migração SQL recriando `get_channel_funnel_metrics`
- 1 ajuste de texto em `ChannelFunnelTable.tsx`
- Sem alteração em hooks, outras páginas, ou no card já corrigido em Reuniões Equipe

