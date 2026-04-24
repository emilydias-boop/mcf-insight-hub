# Correção de Fuso Horário em `useCloserAgendaMetrics`

## 🎯 Problema identificado

O hook `src/hooks/useCloserAgendaMetrics.ts` (usado nas páginas de detalhe individual de SDR/Closer) constrói filtros de data como strings literais:

```ts
.gte('scheduled_at', `${startDate}T00:00:00`)
.lte('scheduled_at', `${endDate}T23:59:59`)
.gte('contract_paid_at', `${startDate}T00:00:00`)
.lte('contract_paid_at', `${endDate}T23:59:59`)
```

O Postgres interpreta essas strings sem timezone como **UTC**. Como o Brasil está em **UTC-3**, qualquer evento entre **21:00 e 23:59 BRT** é deslocado para o dia seguinte nos filtros mensais — exatamente o caso da Rosemeire (paga 23/04 às 22:18 BRT = 24/04 01:18 UTC).

Os demais hooks do painel (`useR1CloserMetrics`, `useR2MeetingSlotsKPIs`) e as RPCs (`get_sdr_metrics_from_agenda`, `get_sdr_meetings_from_agenda`) **já tratam corretamente** o fuso BRT. Essa é a única fonte de divergência detectada.

## 🔧 Mudanças

### Arquivo único: `src/hooks/useCloserAgendaMetrics.ts`

1. Importar `addHours` do `date-fns`.

2. Substituir as strings `yyyy-MM-dd` por timestamps ISO ajustados para BRT:

```ts
const monthStart = startOfMonth(monthDate);
const monthEnd = endOfMonth(monthDate);
const startISO = addHours(monthStart, 3).toISOString();           // 00:00 BRT
const endEnd = new Date(monthEnd); endEnd.setHours(23,59,59,999);
const endISO = addHours(endEnd, 3).toISOString();                  // 23:59:59.999 BRT
```

3. Atualizar as 8 ocorrências de filtros que hoje usam `${startDate}T00:00:00` / `${endDate}T23:59:59`:
   - `meeting_slots.scheduled_at` (bloco 4 — range principal)
   - `meeting_slot_attendees.contract_paid_at` (bloco 6 — contratos por data de pagamento)
   - `meeting_slots.scheduled_at` no fallback de contratos sem timestamp
   - `meeting_slots.scheduled_at` na busca de R2 via `r1DealIds`
   - `meeting_slots.scheduled_at` na busca direta de R2 do closer

   Todas passam a usar `startISO` / `endISO`.

4. Sem alteração de lógica de negócio — apenas a janela temporal. Outside, partner e atribuição permanecem idênticos.

## ✅ Validação esperada

- O contrato da **Rosemeire (23/04 22:18 BRT)** passa a ser atribuído ao dia 23/04 nas métricas individuais.
- Métricas individuais passam a bater com o painel agregado, que já está em BRT.
- Sem risco para fechamentos: eventos em horário comercial (09–18 BRT) já caíam corretos em ambos os fusos.

## 📁 Arquivos afetados

- `src/hooks/useCloserAgendaMetrics.ts` (único)

## 🚫 Fora de escopo

- RPCs SQL (já com `AT TIME ZONE 'America/Sao_Paulo'`)
- Hooks `useR1CloserMetrics`, `useR2MeetingSlotsKPIs` (já com `addHours(date, 3)`)
- Outros painéis não relacionados ao detalhe individual