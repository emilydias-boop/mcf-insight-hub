
## Diagnóstico: Contratos de Follow-Up não aparecem

### Problema 1: Painel Comercial mostra 3 contratos para Cristiane (deveria ser 4)

O hook `useR1CloserMetrics` conta contratos usando `contract_paid_at` no período. Para cada contrato, ele verifica se o `booked_by` é um SDR válido (linha 279-284). Se o follow-up do Flávio Mário (`flavius1313@gmail.com` / `flaviusmario@hotmail.com`) tem `contract_paid_at` fora do dia 10/03, ou se o `booked_by` do attendee não está na lista de SDRs ativos, ele é excluído.

Ação: Verificar no banco os 4 attendees da Cristiane e seus `contract_paid_at` e `booked_by` para identificar qual está sendo filtrado. Se o contrato do Flávio ou Bruno foi pago fora do dia selecionado (ex: 09/03), ele não aparece no filtro de dia único.

### Problema 2: Visão individual mostra apenas 2 vendas (sem follow-ups)

A query de "Leads Realizados" em `useCloserDetailData` (linha 118-136) filtra por `meeting_slots.scheduled_at` no período. Follow-ups onde a R1 aconteceu em uma semana anterior mas o `contract_paid_at` é na semana atual **não aparecem**, pois o `scheduled_at` da reunião está fora do range.

### Correção

**Arquivo: `src/hooks/useCloserDetailData.ts`**

Na query de leads (linhas 109-244), adicionar uma segunda query para buscar attendees com `contract_paid_at` no período, independente do `scheduled_at` da reunião. Isso captura follow-ups:

1. Query existente: busca meetings com `scheduled_at` no período (mantém)
2. Nova query adicional: busca `meeting_slot_attendees` onde `contract_paid_at` está no período E `meeting_slot.closer_id = closerId` E `meeting_type = r1`, independente do `scheduled_at`
3. Mesclar os resultados das duas queries (deduplicar por `attendee_id`)
4. Marcar os follow-ups com um flag para que a UI possa diferenciá-los (ex: badge "Follow-up")

Isso garante que a contagem de "Contrato Pago" no KPI card e a lista de leads estejam consistentes.

**Arquivo: `src/components/closer/CloserLeadsTable.tsx`** (se necessário)
- Adicionar badge visual "Follow-up" para contratos pagos cuja `scheduled_at` é anterior ao período filtrado

### Sobre o Problema 1
Se o Painel Comercial realmente deveria mostrar 4 e não 3, preciso verificar os dados no banco. Se o filtro é "dia 10/03" e um dos 4 contratos foi pago em 09/03 ou 11/03, ele não aparecerá. Isso é comportamento esperado para filtro de dia único. Se o filtro é "semana", todos os 4 deveriam aparecer se pagos na mesma semana.
