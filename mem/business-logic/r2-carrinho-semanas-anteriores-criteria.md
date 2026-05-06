---
name: R2 Carrinho Semanas Anteriores Criteria
description: Janela fixa Qui→Qua, "semana anterior" = contrato em semana calendário anterior, parceiros aparecem com indicador
type: feature
---
# R2 Carrinho — Safra fixa Qui→Qua, "Semanas Anteriores" e indicador de parceria

## Safra operacional (a partir de 06/05/2026)

A safra do Carrinho R2 é uma janela **FIXA de 7 dias corridos**: Quinta 00:00 → Quarta 23:59.
Não existe mais corte intra-dia (sexta 12:00) para fechar/abrir safra. As janelas
`contratos`, `r2Meetings`, `aprovados`, `r1Meetings` e `carrinhoOperacional` são
todas iguais a essa janela em `getCarrinhoMetricBoundaries`.

`previousCutoff` / `safraOpeningCutoff` agora representam **Quinta 00:00 desta safra**.

## Cutoff de "semana anterior" (novo critério)

Um lead é classificado como **"semana anterior"** no painel R2 Carrinho quando:

- Está na janela operacional desta safra (Qui 00:00 → Qua 23:59), E
- `effective_contract_date < boundaries.previousCutoff` (= Qui 00:00 desta safra)

**Regra de negócio:** quem pagou A000 dentro da própria semana calendário Qui→Qua é
da safra atual. Só são "Semanas Anteriores" leads cujo R2 caiu nesta semana mas o
contrato A000 foi pago em uma semana calendário ANTERIOR.

`previousCutoff` agora coincide com `boundaries.contratos.start` por design — é o mesmo Qui 00:00.

## Parceiros: indicador, NÃO exclusão

Parceiros (A001-A009, R001, INCORPORADOR, Renovação, Parceria) **AGORA APARECEM**
nos KPIs operacionais do Carrinho R2 com um sub-indicador `★ N c/ parceria`.
A regra core "parceiros excluídos das métricas" continua valendo APENAS para o
card `contratosPagos` (contratos novos), o que é feito na query SQL via `partnerEmails`.

Em `useR2CarrinhoKPIs`, o `partnerEmailsSet` é usado APENAS para incrementar
contadores `parceriaR2Agendadas`, `parceriaR2Realizadas`, `parceriaNoShowR2`,
`parceriaPendentes`, `parceriaAprovados`, `parceriaForaDoCarrinho` — NÃO mais
como filtro de `continue` no loop. NÃO reintroduzir o `continue` por parceiro.

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
(agora = Qui 00:00 desta safra). Contrato pago antes desse marco = "semana anterior".

## Critério de aceitação

- Soma dos sub-cards `↩ X` (Realizadas + Agendadas + No-Show + Fora + Outros) = total `Semanas Anteriores`
- Parceiros aparecem em todos os KPIs operacionais com indicador `★ N c/ parceria`,
  e ficam excluídos APENAS do card `contratosPagos` (contratos novos)
- Leads com contrato pago dentro da semana Qui→Qua da própria safra contam como
  safra atual (não são mais "semana anterior")
- Janela de Vendas Parceria mantém regra própria: Sex 00:00 → Seg 23:59 da semana seguinte
