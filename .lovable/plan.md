

# Alinhar lista de Contratos Pagos com o indicador (58 → 57)

## Diagnóstico

A diferença de 1 contrato é o **Samuel Figueiredo Siqueira** — um "outside lead" cujo `contract_paid_at` (03:15) é anterior ao `scheduled_at` (17:00) da reunião. O indicador KPI (`useCloserAgendaMetrics`) já exclui outsides; a lista (`useCloserContractsList`) não aplica essa mesma lógica.

## Solução

### Arquivo: `src/hooks/useCloserContractsList.ts`

Adicionar detecção de "outside" igual ao `useCloserAgendaMetrics`:

1. Ao coletar os attendees com `contract_paid` / `refunded`, verificar se `contract_paid_at < scheduled_at` (contrato pago antes da reunião) — se sim, é outside e deve ser excluído da lista
2. Isso alinha a lista com o KPI automaticamente

A lógica é simples: no loop existente (linha 82-98), ao adicionar cada attendee, comparar `att.contract_paid_at` com `slot.scheduled_at`. Se o pagamento foi antes da reunião, pular (`continue`).

## Resultado esperado
- Lista e indicador mostram o mesmo número (57)
- Outsides não aparecem na lista de contratos do closer

