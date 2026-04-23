

## Por que 775 (Painel) ≠ 685 (Relatório) — são métricas diferentes

### Validação no banco (Abril/2026, BU Incorporador)

| Conceito | Valor real | Onde aparece |
|---|---|---|
| **Agendamentos** = SDR clicou "agendar" em abril (`booked_at` em abril) | **780–800** | Painel Comercial (775 ✅) |
| **R1 Agendada** = R1 que vai acontecer em abril (`scheduled_at` em abril), deals únicos da BU | **686** | Funil por Canal (685 ✅) |

Ambos números estão **corretos**, eles medem coisas diferentes:

### Diferença #1 — Janela de tempo (booked_at vs scheduled_at)

- **Painel "Agendamentos"** conta o **ato de agendar** que aconteceu em abril. Se o SDR agendou dia 28/abr uma R1 para 5/maio, conta no painel de abril.
- **Relatório "R1 Agendada"** conta a **R1 que está marcada para abril**. Se a reunião é em abril mas foi agendada em março, conta no relatório de abril.

São janelas opostas — agendamentos feitos em abril para datas futuras vs. reuniões marcadas para abril (independente de quando foram agendadas).

### Diferença #2 — Critério de inclusão

- **Painel** inclui qualquer deal/agendamento feito por SDR com **squad = "incorporador" no momento do agendamento** (via `sdr_squad_history`). Pode incluir leads de outras BUs se um SDR Inc agendar.
- **Relatório** inclui deals cujo `origin_id` **pertence à BU Incorporador**. Mede a perspectiva do *lead*, não do SDR.

No abril, esses dois universos coincidem (todos os 686 deals com R1 da Inc também foram agendados por SDRs Inc), então a diferença é puramente de janela.

### Diferença #3 — Múltiplos agendamentos do mesmo deal

- **Painel** aplica `LEAST(COUNT(DISTINCT meeting_day), 2)` na métrica `r1_agendada` (até 2 movimentos por deal contam) e conta `agendamentos` 1 a 1 (sem cap).
- **Relatório** conta **deals únicos** (1 deal = 1 agendamento). Reagendamentos não inflam.

### O que mostrar para o usuário

A tela do relatório já tem tooltip explicando "métricas filtradas por origem do deal (BU)". Vou **melhorar esse tooltip** e adicionar uma nota explicativa abaixo da tabela:

> **Por que estes números diferem do Painel Comercial?**
> - **Painel Comercial** mede *o trabalho do time SDR Inc*: agendamentos feitos no período (`booked_at`), com até 2 movimentos por deal contando.
> - **Funil por Canal** mede *os deals da BU Inc*: reuniões marcadas para o período (`scheduled_at`), 1 deal = 1 unidade.
>
> Os dois são corretos para perspectivas diferentes. Para gestão do time SDR, use o Painel. Para análise de canal/lead, use o Funil.

### O que vou alterar

**Arquivo único: `src/components/relatorios/ChannelFunnelTable.tsx`**

1. Atualizar tooltip da coluna "R1 Agend." para texto mais didático: "Deals únicos com R1 marcada para o período (`scheduled_at`). Conta 1 por deal — reagendamentos não inflam. Diferente do 'Agendamentos' do Painel Comercial, que conta atos de agendar (`booked_at`) com cap de 2 movs/deal."

2. Adicionar bloco **"Notas metodológicas"** colapsável abaixo da tabela com a explicação completa das 3 diferenças (janela, critério, deduplicação).

### O que NÃO vou alterar

- A lógica do hook `useChannelFunnelReport.ts` está correta (685 é o número certo para a perspectiva "BU = origem do deal").
- A RPC `get_sdr_metrics_from_agenda` está correta (775 é o número certo para a perspectiva "trabalho do SDR Inc").
- Não vou unificar as duas visões — elas servem propósitos distintos.

### Reversibilidade

1 arquivo, ~25 linhas adicionadas (tooltip melhor + bloco explicativo). Reverter = remover o bloco.

