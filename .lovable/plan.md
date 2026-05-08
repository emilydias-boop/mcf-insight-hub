## Objetivo

Corrigir vínculos/atribuições de contratos para a closer Thayna:

1. **Fabíola Beatriz** — recebe o contrato real da Hubla da Andressa da Silva Carreira (R$460,76, 25/04). Hoje esse contrato está vinculado errado ao attendee Erivaldo Pinheiro.
2. **7 leads outside 2024** — marcar como contrato pago antigo (sem Hubla), com data fixa em **2024-01-01**.

---

## Etapa 1 — Revínculo do contrato da Andressa → Fabíola

Operações via insert tool (UPDATE):

- `hubla_transactions` id `60004b22-a686-44c8-bc51-a8de43d1ea9d` (Andressa, R$460,76):
  - `linked_attendee_id` → `41619faa-4cec-4aac-b934-2447a8fa398c` (Fabíola, R1 25/04 com Thayna)
  - `linked_method` → `manual`, `linked_at` → `now()`

- `meeting_slot_attendees` id `41619faa…` (Fabíola):
  - `status` = `contract_paid`
  - `contract_paid_at` = `2026-04-25 19:04:11.279+00` (sale_date Hubla)

- `meeting_slot_attendees` id `6677878a-3dee-4909-acd4-090e622cb6b1` (Erivaldo Pinheiro):
  - `status` = `completed`, `contract_paid_at` = `null`

- `crm_deals` `773b2e2c-…` (Fabíola): mover para stage "Contrato Pago" da pipeline correspondente.
- `crm_deals` `34772584-…` (Erivaldo): mover de "Contrato Pago" de volta para "Reunião 01 Realizada".

---

## Etapa 2 — 7 leads outside 2024

Para cada attendee abaixo: `status = 'contract_paid'`, `contract_paid_at = '2024-01-01 12:00:00+00'`. Sem criar `hubla_transactions`. Mover deal correspondente para stage "Contrato Pago" da pipeline de origem.

| # | Lead | Telefone | R1 Thayna | Status atual |
|---|---|---|---|---|
| 1 | Carlos | 67 9960-5844 | 07/04 19:45 | completed |
| 2 | Victor Caixeiro | 32988112033 | 09/04 19:15 | completed |
| 3 | Filipe Amaral | 54997038463 | 15/04 21:00 | completed (Venda Realizada) |
| 4 | Luciano Gazen / Vinicius Barbosa | 22997084461 | 17/04 13:45 | completed |
| 5 | Diogo Giuseppin | 19971094264 | 24/04 19:45 | completed |
| 6 | Ricardo Gomes | 62998860906 | 28/04 18:30 | contract_paid (sobrescrever data) |
| 7 | Mauro Elias | 5193935610 | 29/04 20:00 | contract_paid (sobrescrever data) |

> **NBC Engenharia** já está em No-Show e não entra na correção (não conta como R1 Realizada).
> **Fabíola** NÃO entra nos outside — ela recebe o contrato real da Andressa (Etapa 1).

---

## Detalhes técnicos

- Tudo é DML (UPDATE), executado em uma única migração de dados via insert tool.
- Stage "Contrato Pago" resolvida dinamicamente por `origin_id` do deal + `ilike '%contrato%pago%'` (mesma lógica de `useLinkContractToAttendee.ts`).
- Após execução: validar em "Closer Performance" do Thayna que os 7 leads + Fabíola aparecem em Contrato Pago e somem de "R1 Realizada"; e que Erivaldo voltou para R1 Realizada.