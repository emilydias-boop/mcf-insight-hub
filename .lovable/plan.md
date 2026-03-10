

## Análise: R2 Agendadas (50) vs Contratos Pagos (47)

### Causa da discrepância

O cálculo de R2 Agendadas (linhas 206-233 de `useCloserAgendaMetrics.ts`) coleta **todos os deal_ids** dos attendees R1 do closer, **independente do status**. Isso inclui deals com status `completed`, `no_show`, `invited` -- não apenas `contract_paid`/`refunded`.

Ou seja, se um deal teve R1 com status `completed` (sem contrato pago) mas mesmo assim alguém agendou um R2 para esse deal, ele é contado nas R2 Agendadas. Isso explica os 3 a mais (50 - 47 = 3).

### Correção proposta

Filtrar os `r1DealIds` para incluir **apenas deals cujo attendee tem status `contract_paid` ou `refunded`** (excluindo parceiros). Isso garante que R2 Agendadas reflete apenas leads que efetivamente pagaram contrato.

| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `useCloserAgendaMetrics.ts` (linhas 204-217) | Filtrar `r1DealIds` para incluir apenas attendees com status `contract_paid` ou `refunded` e `!is_partner` |

### Código atual vs proposto

**Atual** (coleta TODOS os deal_ids):
```
for (const slot of (slots || [])) {
  if (slot.deal_id) r1DealIds.push(slot.deal_id);
  for (const att of slot.meeting_slot_attendees) {
    if (att.deal_id) r1DealIds.push(att.deal_id);
  }
}
```

**Proposto** (filtra por contract_paid/refunded):
```
for (const slot of (slots || [])) {
  for (const att of slot.meeting_slot_attendees) {
    if (att.deal_id && !att.is_partner && 
        ['contract_paid', 'refunded'].includes(att.status)) {
      r1DealIds.push(att.deal_id);
    }
  }
}
```

### Resultado esperado
- R2 Agendadas passaria a ser <= Contratos Pagos (47 ou menos, dependendo de quantos contratos efetivamente tiveram R2 agendada)

