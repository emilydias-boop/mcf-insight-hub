

## Corrigir `contract_paid_at` desalinhado da data real da venda Hubla

### Diagnóstico (caso Giovani Tomazini)

Confirmado pelos dados:

| Fonte | Data |
|---|---|
| **Hubla** (transação real, `product_category=incorporador`) | **20/04/2026 18:04** |
| **Make webhook** (espelho contrato, `linked_attendee_id` preenchido) | **20/04/2026 18:04** |
| **meeting_slot_attendees.contract_paid_at** (no app) | **15/04/2026 21:00** ❌ |
| **meeting_slots.scheduled_at** (R1 com Thayna) | 15/04/2026 21:00 |

O `contract_paid_at` foi gravado **igual ao `scheduled_at` da reunião**, não com a `sale_date` real da Hubla. Por isso ele não apareceu no dia 20: a contagem filtra `contract_paid_at BETWEEN '2026-04-20 00:00' AND '23:59'`, e o registro está no dia 15.

### Causa raiz provável

Quando alguém marca o attendee como `contract_paid` manualmente no drawer da agenda, o sistema usa `now()` ou o `scheduled_at` da reunião como fallback para `contract_paid_at`, em vez de buscar a data real da `hubla_transactions` vinculada (`linked_attendee_id`).

No caso do Giovani, a transação Hubla **foi vinculada** ao attendee (`linked_attendee_id = 0f685879...`), então a `sale_date` correta (`20/04 18:04`) está disponível mas não foi propagada.

### Plano de correção

**Etapa 1 — Investigar e mostrar a divergência (read-only, faço já)**

Rodar query que lista todos os attendees `contract_paid` com `linked_attendee_id` na transação Hubla onde `attendee.contract_paid_at` ≠ `hubla_transactions.sale_date`. Isso te dá o tamanho do problema (quantos contratos estão com data errada e em quais closers/meses afeta a contagem).

**Etapa 2 — Backfill (migration)**

Migration única que atualiza `meeting_slot_attendees.contract_paid_at` para `hubla_transactions.sale_date` quando:
- `attendee.status IN ('contract_paid','refunded')`
- existe `hubla_transactions WHERE linked_attendee_id = attendee.id` com `sale_status='completed'`
- as datas divergem em mais de 1 hora (margem de timezone)

Usa a `sale_date` da transação Hubla mais antiga (caso múltiplas) como fonte de verdade.

**Etapa 3 — Corrigir a origem do bug (forward fix)**

Identificar onde `contract_paid_at` é gravado:
- `useUpdateAttendeeStatus` / drawer de agenda (marcação manual)
- Edge function `link-hubla-transaction` ou similar (vinculação automática)
- Trigger no Postgres se existir

Em cada ponto que setar `status='contract_paid'`, **buscar a `sale_date` da transação Hubla vinculada** e usar ela. Fallback para `now()` só se não houver transação vinculada.

**Etapa 4 — Validação**

Após backfill, reconfirmar que Giovani Tomazini aparece nos contratos da Thayna em **20/04** (esperado: total da Thayna passa de 5 → 6 nesse dia, e o dia 15 perde 1).

### Confirmar antes de seguir

1. **Política de data**: usar `sale_date` da Hubla como fonte de verdade para `contract_paid_at` (recomendado, pois é a data real do pagamento)?
2. **Escopo do backfill**: corrigir **todos os contratos históricos** com divergência, ou só os de **2026** (mês corrente + retroativo curto)?
3. **Múltiplas transações**: se o lead tem várias `hubla_transactions` vinculadas (ex: parcelas), usar a **mais antiga** (primeira parcela = data do contrato) ou a **mais recente**?

