

## Diagnóstico: 5 contratos no painel vs 6 na Hubla (13/03)

### Causa raiz

O contrato do **Rafael Andrade Oliveira** (`rafaelandrade4143@gmail.com`) não aparece no dia 13/03 no painel porque o campo `contract_paid_at` do attendee (`04af9854`) está com o valor errado:

| Campo | Valor | Dia BRT |
|-------|-------|---------|
| `contract_paid_at` (attendee) | `2026-03-12 23:30 UTC` | **12/03** (20:30 BRT) |
| `sale_date` (Hubla) | `2026-03-13 14:57 UTC` | **13/03** (11:57 BRT) |
| `scheduled_at` (reunião) | `2026-03-12 23:30 UTC` | **12/03** |

O `contract_paid_at` foi preenchido com o `scheduled_at` da reunião em vez da `sale_date` real da transação Hubla. Resultado: o painel conta esse contrato no dia **12/03** (data errada), não no **13/03**.

### Solução

**1. Corrigir o dado pontual (migration SQL)**
- Atualizar o `contract_paid_at` do attendee `04af9854-29b9-4ffa-8875-4107a615dd1b` para `2026-03-13 14:57:29.563+00` (sale_date real).

**2. Verificar e corrigir outros registros com o mesmo problema**
- Executar uma query que compara `contract_paid_at` dos attendees vinculados vs `sale_date` das transações Hubla, identificando discrepâncias onde a diferença é maior que 1 hora.
- Atualizar em lote os `contract_paid_at` para refletir a `sale_date` real.

A migration fará ambos os passos em uma única execução.

