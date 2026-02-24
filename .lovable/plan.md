

## Filtrar socios das metricas de closer e agenda

### Problema

Os hooks `useMeetingSlotsKPIs`, `useR2MeetingSlotsKPIs` e `useCloserAgendaMetrics` contam **todos** os attendees, incluindo socios (`is_partner = true`). Isso infla as metricas de R1 Agendada, R1 Realizada, No-Show, e R1 Alocadas quando um socio tem seu status alterado.

### Alteracoes

**1. `src/hooks/useMeetingSlotsKPIs.ts`**
- Adicionar `is_partner` ao select da query
- Filtrar attendees com `is_partner = true` antes de contar as metricas (Agendadas, Realizadas, No-Shows)

**2. `src/hooks/useR2MeetingSlotsKPIs.ts`**
- Mesma correcao: adicionar `is_partner` ao select e filtrar socios antes de contar R2 Agendadas e R2 Realizadas

**3. `src/hooks/useCloserAgendaMetrics.ts`**
- Na query de slots (linha 66-72), adicionar `is_partner` ao select dos attendees
- No loop de contagem (linhas 88-106), pular attendees onde `is_partner = true`
- Nas queries de contratos pagos (linhas 110-142), adicionar `.eq('is_partner', false)` para excluir socios
- Na query de vendas parceria (linha 174), filtrar attendeeIds para excluir socios

### Resultado

Socios continuam visiveis na agenda para controle visual, mas nao afetam nenhuma metrica (R1 Agendada, Realizada, No-Show, Contratos Pagos) nem para closers nem para KPIs gerais.
