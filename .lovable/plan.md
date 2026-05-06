## Objetivo

Marcar **Mauro Elias** como **Outside** no sistema de conversão do Closer, com data real de pagamento do contrato em **02/04/2025**.

## Situação atual

Mauro tem 2 registros em `meeting_slot_attendees`:

| Attendee ID | R1 em | Status | contract_paid_at |
|---|---|---|---|
| `9c5e904a-...c44` | 24/04/2026 | no_show | NULL |
| `69db7b72-...e75` | 29/04/2026 | completed | NULL |

O contrato foi pago em **02/04/2025** — anterior a ambos os R1, portanto Outside.

## Mudança proposta (1 UPDATE)

No attendee `69db7b72-e464-47b4-9c2f-1598f4c96e75` (R1 realizado de 29/04/2026):

- `status` → `'contract_paid'`
- `contract_paid_at` → `2025-04-02T12:00:00+00:00`

## Resultado

- Como `contract_paid_at` (02/04/2025) é anterior ao R1 (29/04/2026), o sistema classifica como **Outside**.
- Mauro **NÃO** conta na conversão da Thaynara (Closer).
- Aparece como "Contrato Pago" no funil/lead com a data correta de 02/04/2025.
- R1 de 24/04 (no_show) permanece inalterado.

## Fora de escopo

- Não criar registro em `hubla_transactions` (manteria invisível para Outside Detection do SDR, igual ao Ricardo).