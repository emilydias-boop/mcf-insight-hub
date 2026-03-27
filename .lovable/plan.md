

## Outside: Atribuir pela Data da Compra, nao pela Data da Reuniao

### Problema atual

Hoje o outside aparece no painel no dia da **reuniao R1** (scheduled_at). Exemplo: contrato comprado em 25/02, reuniao em 27/03 — o outside aparece em 27/03. O correto e aparecer em **25/02**, que e quando a compra aconteceu.

A exclusao das metricas do closer (R1 Agendada, Realizada, No-show) continua igual — outsides sao excluidos independente da data.

### Mudanca

A contagem de outsides por closer precisa ser invertida: em vez de "pegar reunioes no periodo e ver quais tem contrato anterior", fazer "pegar contratos no periodo e ver quais tem reuniao posterior".

### Arquivos editados

**`src/hooks/useR1CloserMetrics.ts`** — Bloco "OUTSIDE DETECTION" (linhas 300-387)

Logica atual:
1. Busca meetings no periodo → detecta quais attendees tem contrato anterior → conta outside

Logica nova:
1. Buscar `hubla_transactions` com `sale_date` no periodo filtrado, `product_category` contrato/incorporador, `sale_status = completed`
2. Para cada contrato encontrado, buscar se existe meeting R1 com `scheduled_at > sale_date` para o mesmo email
3. Se existe meeting posterior, contar o outside no closer daquela meeting, mas atribuido ao periodo do `sale_date`

Isso significa: buscar meetings **sem filtro de data** para os emails dos contratos do periodo, e verificar se alguma R1 e posterior.

**`src/hooks/useSdrOutsideMetrics.ts`** — Mesma inversao de logica

Logica atual: busca meetings no periodo → detecta outsides
Logica nova: busca contratos no periodo → verifica se tem R1 posterior → conta outside por SDR (booked_by da meeting)

**`src/hooks/useCloserAgendaMetrics.ts`** — Ajuste na contagem de outsides

Mesma inversao: contar outsides pelo `sale_date` dentro do mes, nao pelo `scheduled_at`.

### O que NAO muda
- Exclusao de outsides das metricas do closer (R1 Agendada, Realizada, No-show) — continua baseada na reuniao
- `contrato_pago` contagem (baseada em `contract_paid_at`)
- Deteccao de outside no kanban, na agenda R2, nos drawers
- Nenhuma migration

