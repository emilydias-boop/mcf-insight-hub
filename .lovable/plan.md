## Confirmado

- **Fabíola** ← contrato real Hubla da Andressa (R$460,76, 25/04/2026).
- **Erivaldo** continua como contrato pago, mas como **outside 2024** (separado, não compartilha com a Fabíola).

## Etapa 1 — Vínculo Hubla Andressa → Fabíola

- `hubla_transactions` `60004b22-…`: `linked_attendee_id` = `41619faa-…` (Fabíola), `linked_method='manual'`, `linked_at=now()`
- `meeting_slot_attendees` `41619faa-…` (Fabíola): `status='contract_paid'`, `contract_paid_at='2026-04-25 19:04:11.279+00'`
- `crm_deals` `773b2e2c-…` (Fabíola): stage → "Contrato Pago" (`062927f5-…`)

## Etapa 2 — 8 outside 2024 (sem Hubla)

`status='contract_paid'`, `contract_paid_at='2024-01-01 12:00:00+00'`, deal → "Contrato Pago" (`062927f5-…`):

| # | Lead | Attendee ID | Deal ID |
|---|---|---|---|
| 1 | Carlos | b23529bc-… | 6c71148e-… |
| 2 | Victor Caixeiro | f084e422-… | 6c62d6cd-… |
| 3 | Filipe Amaral | b967f678-… | 31aedb86-… |
| 4 | Vinicius/Luciano | 32fb2c6b-… | d9827cae-… |
| 5 | Diogo Giuseppin | 5e471746-… | 5ce3eb15-… |
| 6 | Ricardo Gomes | ebc92763-… | 724d9aae-… |
| 7 | Mauro Elias | 69db7b72-… | 3eafd87f-… |
| 8 | **Erivaldo Pinheiro** | 6677878a-… | 34772584-… |

> O vínculo da transação Hubla sai do Erivaldo (na Etapa 1) e ele recebe `contract_paid_at='2024-01-01'` aqui. Sem nova transação Hubla.

## Resultado p/ Thayna

9 contratos pagos: 1 real abril/26 (Fabíola) + 8 outside jan/24.