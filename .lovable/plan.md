

# Alinhar KPIs do topo com a tabela de Closers

## Situacao atual

Os KPIs do topo e a tabela de SDRs usam `useTeamMeetingsData` (RPC `get_sdr_metrics_from_agenda`), que ja distingue:
- **Agendamentos** = criados no periodo (`booked_at`/`created_at`)
- **R1 Agendada** = reunioes agendadas PARA o periodo (`scheduled_at`)

A tabela de Closers usa `useR1CloserMetrics` (queries diretas em `meeting_slots`), que conta por `scheduled_at` do closer. A diferenca (286 vs 321) ocorre porque alguns leads foram atribuidos a closers de consorcio mas agendados por SDRs de outra squad, ou vice-versa.

## Proposta

Quando a aba "Closers" estiver ativa, os KPIs do topo devem refletir os totais da tabela de closers (soma dos `closerMetrics`), nao os do SDR. Isso garante consistencia visual.

### Alteracao unica: `src/pages/bu-consorcio/PainelEquipe.tsx`

- Criar um `closerKPIs` derivado da soma de `closerMetrics` (r1_agendada, r1_realizada, noshow)
- No componente `TeamKPICards`, passar `closerKPIs` quando `activeTab === 'closers'` e `enrichedKPIs` quando `activeTab === 'sdrs'`
- Isso faz com que ao clicar em "Closers", os cards de R1 Agendada, Realizada e No-Show atualizem para bater com a tabela

## Resultado
- Aba SDRs: KPIs mostram 286 agendamentos, coerente com a tabela SDR
- Aba Closers: KPIs mostram 321 agendadas, coerente com a tabela Closer
- Sem ambiguidade entre os numeros

## Arquivo alterado
1. `src/pages/bu-consorcio/PainelEquipe.tsx`

