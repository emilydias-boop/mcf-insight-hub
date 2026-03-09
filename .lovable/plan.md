

## Problema: "Agendamentos" no KPI (275) ≠ "R1 Agendada" total da tabela (289)

### Causa

O `enrichedKPIs` sobrescreve `totalR1Agendada`, `totalRealizadas` e `totalNoShows` com dados dos closerMetrics, mas o card "Agendamentos" usa `kpis.totalAgendamentos` — que ainda vem da RPC antiga (SDR-based). São dois campos diferentes no objeto `TeamKPIs`.

### Correção

**`src/pages/crm/ReunioesEquipe.tsx`** — linha 281-294: Adicionar `totalAgendamentos: r1FromClosers.r1Agendada` ao `enrichedKPIs`, fazendo o card "Agendamentos" usar a mesma fonte da tabela de closers.

Isso garante que o card mostrará 289, igual ao total da tabela.

