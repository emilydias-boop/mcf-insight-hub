

## Opção C — Igualar card "R1 Agendada" à tabela (base `booked_at`)

### Mudança
Arquivo único: `src/pages/crm/ReunioesEquipe.tsx`

No bloco `enrichedKPIs`, alterar a fonte do card **R1 Agendada** para usar agendamentos criados no período (mesma definição da coluna "Agendamentos" da tabela):

| Campo | Antes | Depois |
|---|---|---|
| `totalR1Agendada` | `teamKPIs.totalR1Agendada` (base `scheduled_at` → 806) | `teamKPIs.totalAgendamentos` (base `booked_at` → 784) |
| `taxaNoShow` | `(noShows / totalR1Agendada_scheduled) * 100` | `(noShows / totalAgendamentos_booked) * 100` |

### Resultado esperado (Abril/26, BU Incorporador)
- **R1 Agendada (card):** 806 → **784** (igual à tabela e ao painel)
- **Taxa No-Show:** recalculada sobre a nova base 784
- Card, tabela e painel passam a mostrar exatamente o mesmo número

### Observação
Perde-se a visão "reuniões que acontecem no mês" (scheduled_at). Caso queira recuperá-la depois, basta adicionar um card extra. Métricas financeiras (contratos, faturamento) permanecem inalteradas.

### Escopo
- Apenas `src/pages/crm/ReunioesEquipe.tsx`
- Sem alteração em RPC, hooks ou outras páginas

