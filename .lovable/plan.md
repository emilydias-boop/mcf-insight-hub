
# Corrigir Carrinho R2 — Mostrar R2s da janela operacional, nao da safra

## Diagnostico

O Carrinho R2 mostra **"Todas R2s: 0"** mesmo com 9 reunioes R2 agendadas na semana. A causa:

- A aba "Todas R2s" usa logica de **safra** (contratos pagos Qui 02/04 - Qua 08/04) e procura R2s desses contratos
- Os 3 contratos desta safra (Bruno, Leandro, Thiago) ainda nao tem R2 agendada
- As 9 R2s visiveis na Agenda R2 sao de contratos da **safra anterior** (26/03-01/04), cujas R2s foram agendadas para esta semana

O sistema ja calcula uma janela operacional de R2 (`r2Meetings: Sex 03/04 → Sex 10/04`) mas essa janela **nao e usada** pela aba "Todas R2s" — so e usada pela aba "Aprovados".

## Proposta

A aba "Todas R2s" (e as sub-abas Fora do Carrinho, Pendentes) deve mostrar **todas as R2 meetings agendadas na janela operacional** (Sex-Sex), independente de quando o contrato foi pago. A logica de safra continua valida apenas para o KPI "Contratos (R1)".

### Alteracao 1: `src/hooks/useR2CarrinhoData.ts`

Para os filtros `agendadas`, `no_show`, `realizadas`:
- **Atual**: Busca contratos da safra → resolve contatos → busca R2s desses contatos apos sale_date
- **Novo**: Busca diretamente R2 attendees com `meeting_slot.scheduled_at` dentro da janela `boundaries.r2Meetings` (Sex-Sex), igual ao que ja faz para `aprovados`
- Manter enriquecimento com dados de R1 (closer, data) e deal info
- Aplicar filtros de status do slot (agendadas = nao cancelled/rescheduled, no_show, realizadas = completed)

### Alteracao 2: `src/hooks/useR2CarrinhoKPIs.ts`

Alinhar KPIs de R2 (Agendadas, Realizadas, Fora do Carrinho, Pendentes) com a mesma janela operacional:
- `contratosPagos`: continua usando safra (Thu-Wed) — correto
- `r2Agendadas`, `r2Realizadas`, `foraDoCarrinho`, `pendentes`, `emAnalise`: usar janela `r2Meetings` (Sex-Sex) em vez de filtrar por safra de contratos
- `aprovados`: ja usa janela operacional — sem mudanca

### Alteracao 3: `src/hooks/useR2ForaDoCarrinhoData.ts`

Mesmo ajuste: buscar R2 attendees na janela operacional com status "fora do carrinho", em vez de filtrar por safra de contratos.

## Resultado esperado

- "Todas R2s" mostrara as 9 reunioes agendadas para esta semana (Lindenberg, Pedro, Junio, etc.)
- "Contratos (R1)" continua mostrando 3 (contratos pagos nesta safra)
- KPIs de R2 refletirao a operacao real da semana
- Aprovados permanece igual (ja funciona com janela operacional)

## Arquivos alterados
1. `src/hooks/useR2CarrinhoData.ts` — buscar R2s pela janela operacional
2. `src/hooks/useR2CarrinhoKPIs.ts` — alinhar KPIs de R2 com janela operacional
3. `src/hooks/useR2ForaDoCarrinhoData.ts` — alinhar fora do carrinho com janela operacional
