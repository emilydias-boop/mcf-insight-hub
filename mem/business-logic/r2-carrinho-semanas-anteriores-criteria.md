---
name: R2 Carrinho Semanas Anteriores Criteria
description: Critérios para classificar lead como "semana anterior" e exclusão de parceiros nos KPIs do Carrinho R2
type: feature
---
# R2 Carrinho — "Semanas Anteriores" e exclusão de parceiros

## Cutoff de "semana anterior"

Um lead é classificado como **"semana anterior"** no painel R2 Carrinho quando:

- Está na janela operacional desta safra (`carrinhoOperacional`: corte anterior → corte atual), E
- `effective_contract_date < boundaries.previousCutoff` (Sex 12:00 da semana anterior)

**Regra de negócio:** o ciclo do carrinho ABRE no corte da sexta. Quem pagou contrato
antes desse corte — mesmo que tenha sido na própria quinta da safra atual — é considerado
"vindo de semana anterior", pois entrou na safra ANTES do carrinho abrir.

NÃO usar `boundaries.contratos.start` (Qui 00:00) como referência: a janela de contratos
existe só para contagem de "Contratos Pagos" e tem semântica diferente do carrinho operacional.

## Exclusão de parceiros nos KPIs operacionais

A regra core "Partner/renewal products A001-A009, R001, INCORPORADOR são excluídos
das métricas" aplica-se a **TODOS** os KPIs do Carrinho R2, não só ao `contratosPagos`.

Em `useR2CarrinhoKPIs`, o `Set<partnerEmails>` (construído cruzando hubla_transactions
por A001-A009/R001/INCORPORADOR/Renovação/Parceria na janela de contratos) é usado
como filtro logo no início do loop de `unifiedData`:

```ts
const rowEmail = (row.contact_email || '').toLowerCase().trim();
if (rowEmail && partnerEmailsSet.has(rowEmail)) continue;
```

Isso evita que parceiros apareçam em `r2Realizadas`, `r2Agendadas`, `noShowR2`,
`aprovados`, `semanasAnteriores`, `pendentes`, `desistentes`, `foraDoCarrinho`.

## Bucket "Outros"

`semanasAnterioresOutros` captura leads de semana anterior cujo estado não cai em
nenhum dos 4 buckets visíveis (Realizada/Agendada/No-Show/Fora). Funciona como
rede de segurança/diagnóstico. Em operação normal deve ficar **zero** — se subir,
investigar pois indica um estado de attendee não previsto na classificação.
No tooltip do card "Contratos → Semanas Anteriores", a linha "Outros" só aparece
quando o valor é > 0.

## SCHEDULED_STATES — inclui 'rescheduled'

Em `useR2CarrinhoKPIs.ts`:

```ts
const SCHEDULED_STATES = new Set(['invited', 'scheduled', 'pending', 'pre_scheduled', 'rescheduled']);
```

Por que `rescheduled` é agendado válido: quando um attendee é remarcado, o
`meeting_slot_attendees.status` permanece `'rescheduled'` mesmo quando existe um
slot novo ATIVO (`meeting_slots.status = 'scheduled'`) com horário futuro.
O `isAgendada(row)` já garante que o slot atual NÃO está cancelado/desmarcado
(ele lê `row.meeting_status`, do slot — não do attendee), então é seguro tratar
`attendee.status = 'rescheduled'` como agendamento válido nesse contexto.

Sem essa inclusão, leads remarcados desaparecem do KPI principal `r2Agendadas`
e caem no bucket "Outros" de Semanas Anteriores. Caso de regressão: Alexandre
Donizete (06/mai/2026) — R2 agendada para hoje 15:15 mas attendee `rescheduled`,
ficava invisível no card R2 Agendadas e o "↩ Outros" subia indevidamente.

## Pendentes ↩

`useR2PendingLeadsBreakdown(previousCutoff)` recebe o `previousCutoff` do carrinho
(Sex 12:00 da semana anterior). Mesmo critério aplicado: contrato pago antes do
corte de abertura da safra = lead vindo de semanas anteriores.

## Critério de aceitação

- Soma dos sub-cards `↩ X` (Realizadas + Agendadas + No-Show + Fora + Outros) = total `Semanas Anteriores`
- Parceiros (ex.: cliente que comprou A001 na safra) não aparecem em nenhum KPI
- Leads com contrato pago entre Qui 00:00 e Sex 12:00 da própria safra SÃO contados
  como "semana anterior" (ciclo operacional só abre no corte da sexta)
