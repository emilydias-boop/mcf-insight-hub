

## Problema: KPI Cards e Tabela de Closers mostram números diferentes

### Números reais do banco (Março 2026, BRT, incorporador)

| Status | Contagem Real |
|--------|--------------|
| completed | 148 |
| no_show | 113 |
| invited (pendentes) | 43 |
| contract_paid | 42 |
| rescheduled | 7 |
| refunded | 2 |

Total attendees válidos (incorporador): **264** (84 foram agendados por SDRs do consórcio — Cleiton, Ithaline, Ygor — e devem ser excluídos)

### Causas das discrepâncias

**1. KPI Cards usam a RPC `get_sdr_metrics_from_agenda`** que:
- Agrupa por SDR (booked_by), não por Closer
- Inclui `rescheduled` na contagem de R1 Agendada (deveria excluir)
- Calcula No-Shows como fórmula `r1_agendada - r1_realizada` (inclui `invited`/pendentes como no-shows)
- Não filtra por SDRs do incorporador vs consórcio

**2. Tabela de Closers usa `useR1CloserMetrics`** que:
- Agrupa por Closer
- Exclui `rescheduled` corretamente
- Conta No-Shows pelo status real (`no_show`)
- Filtra por bookers válidos do incorporador
- Mas **não inclui `refunded` como realizada** (deveria)

### Solução: Closers Table como fonte da verdade

A tabela de Closers tem a lógica mais correta. A solução é:
1. Corrigir o pequeno bug de `refunded` no hook de Closers
2. Fazer os KPI Cards derivarem R1 Agendada, Realizadas e No-Shows dos totais da tabela de Closers (já funciona assim para Contratos)

### Mudanças

**1. `src/hooks/useR1CloserMetrics.ts`** — Adicionar `refunded` como status válido

- Linha 82: Adicionar `'refunded'` ao array `allowedAgendadaStatuses`
- Linhas 455-462: Adicionar `refunded` ao bloco de `r1_realizada` (junto com `completed`)

**2. `src/pages/crm/ReunioesEquipe.tsx`** — Derivar KPIs de R1 da tabela de Closers

- Linhas 271-280: Expandir `enrichedKPIs` para também sobrescrever `totalR1Agendada`, `totalRealizadas`, `totalNoShows` e `taxaNoShow` com os totais calculados de `closerMetrics`, em vez de usar os valores da RPC

### Resultado esperado

Ambos mostrarão os mesmos números porque usam a mesma fonte:
- **R1 Agendada**: soma de `r1_agendada` de todos os closers ≈ 264
- **Realizadas**: soma de `r1_realizada` (incluindo `refunded`) ≈ 192
- **No-Shows**: soma de `noshow` (status real) ≈ 113
- **Contratos**: já alinhado via `contractsFromClosers`

