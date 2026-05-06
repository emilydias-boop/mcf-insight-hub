## Diagnóstico definitivo do "órfão"

Investiguei o **Alexandre Donizete de Souza** (deal `82ab1397...`) no banco e confirmei o que você viu:

| Campo | Valor |
|---|---|
| Stage atual | **Contrato Pago** (PIPELINE INSIDE SALES) |
| `contract_paid_at` | 27/abr 14:29 — **antes** do corte da safra atual (Sex 02/mai 12:00) ✓ semana anterior |
| R2 agendada | **06/mai 18:15 UTC = 15:15 BRT** ✓ hoje |
| `meeting_slots.status` | `scheduled` ✓ agendada |
| `meeting_slot_attendees.status` | **`rescheduled`** ← ⚠️ aqui está o problema |
| `r2_status_id` | `NULL` |
| `is_partner` | `false` |

Ele **não é parceiro** e **tem R2 marcada para hoje 15:15**. Ele deveria contar como **R2 Agendada ↩ (Semanas Anteriores)**, mas está caindo no bucket "Outros".

## Causa raiz

O lead foi reagendado em algum momento (`is_reschedule = true` no attendee). Quando isso acontece, o `attendee.status` fica como `'rescheduled'` mesmo que o slot novo esteja com `status = 'scheduled'` e ativo no futuro.

A classificação em `useR2CarrinhoKPIs.ts` (linhas 200–211) faz:

```ts
} else if (isAgendada(row) && SCHEDULED_STATES.has((row.attendee_status || '').toLowerCase())) {
  semanasAnterioresAgendadas++;
}
```

Onde `SCHEDULED_STATES = ['invited', 'scheduled', 'pending', 'pre_scheduled']`. Como o `attendee_status` é `'rescheduled'`, ele falha esse teste e cai no `else { semanasAnterioresOutros++ }`.

Mas a função `isAgendada` (em `useCarrinhoUnifiedData.ts` linha 137) usa o `meeting_status` (do slot), não o `attendee_status`:

```ts
return row.meeting_status !== 'cancelled' && row.meeting_status !== 'rescheduled';
```

E o `meeting_status` do Alexandre é `scheduled` (o slot novo após reagendamento). Ou seja, **a regra está dupla e inconsistente**: um trecho confia no slot, o outro descarta o attendee `rescheduled`.

Note também que esse mesmo bug acontece no KPI principal **R2 Agendadas** (linha 181) — leads reagendados ficam invisíveis lá também.

## Plano de correção

### 1. Tratar `attendee.status = 'rescheduled'` como agendado válido quando o slot ainda está ativo

Em `src/hooks/useR2CarrinhoKPIs.ts`, alterar a checagem de "agendada" para considerar `rescheduled` quando o **slot** está em estado válido (não cancelado e com data futura/válida).

Substituir nas duas ocorrências (linhas 181 e 207):

- **Antes**: `isAgendada(row) && SCHEDULED_STATES.has(attendee_status)`
- **Depois**: `isAgendada(row) && (SCHEDULED_STATES.has(attendee_status) || attendee_status === 'rescheduled')`

Justificativa: o `isAgendada` já garante que o slot não foi cancelado/desmarcado. Se o attendee virou `rescheduled` mas o slot atual está `scheduled`, é porque foi remarcado para um novo horário válido — deve contar como agendado.

### 2. Validar com o Alexandre

Após a mudança:
- **R2 Agendadas (total)**: +1 (Alexandre passa a contar)
- **R2 Agendadas ↩ (semanas anteriores)**: 2 → 3
- **Outros (semanas anteriores)**: 1 → 0
- **Total Semanas Anteriores**: continua 11
- **Soma dos sub-cards**: 3 + 7 + 1 + 0 + 0 = **11** ✓ fecha sem precisar do bucket "Outros"

### 3. Drill-down (lista detalhada)

Verificar `src/hooks/useR2PendingLeads.ts` (`useR2PendingLeadsBreakdown`) — se ele usa a mesma classificação, aplicar a mesma correção para que o Alexandre apareça na coluna "Agendadas" do detalhamento, não em "Outros".

### 4. Limpeza opcional (recomendada)

Como agora "Outros" fica zerado nos casos esperados, manter o bucket `semanasAnterioresOutros` como **rede de segurança** (logging/diagnóstico) mas não exibir como linha no tooltip a menos que `> 0`. Isso evita confusão futura.

### 5. Memória

Atualizar `mem://business-logic/r2-carrinho-semanas-anteriores-criteria.md` adicionando a regra:

> Leads com `attendee.status = 'rescheduled'` cujo slot atual está em estado válido (`meeting_status` ≠ cancelled/rescheduled) DEVEM contar como **R2 Agendada**. O `attendee.status = 'rescheduled'` reflete o histórico do attendee, não o estado atual do slot.

## Arquivos afetados

- `src/hooks/useR2CarrinhoKPIs.ts` — duas linhas (181 e 207)
- `src/hooks/useR2PendingLeads.ts` — verificar e aplicar mesma regra se necessário
- `src/pages/crm/R2Carrinho.tsx` — tooltip (esconder linha "Outros" se zero)
- `mem://business-logic/r2-carrinho-semanas-anteriores-criteria.md` — documentar a regra

Sem migração de banco. Mudança puramente de classificação no frontend.