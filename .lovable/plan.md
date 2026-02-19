
# Corrigir R1 Agendada no Painel Consorcio

## Problema confirmado

A formula atual de R1 Agendada esta errada em todos os periodos:

- **Dia**: `totalRealizadas(0) + totalNoShows(1) + pendentesHoje(30)` = **31**, quando o correto e **1** (apenas 1 reuniao agendada para hoje por SDRs do consorcio)
- **Semana/Mes**: `totalRealizadas + totalNoShows` = ignora reunioes pendentes, mas pelo menos nao soma pendentes de outras BUs

O `useMeetingsPendentesHoje()` conta pendentes de TODAS as BUs (hoje: 28 invited + 2 rescheduled = 30), sem nenhum filtro por squad.

### Dados reais de hoje (banco):
| SDR | Agendamento (booked today) | R1 Agendada (scheduled today) | Status |
|---|---|---|---|
| Cleiton Lima | 0 | 1 | no_show |
| Ithaline Clara | 1 | 0 | invited |

Valores corretos para hoje: Agendamento=1, R1 Agendada=1, R1 Realizada=0, No-Show=1

## Solucao

Substituir a formula manual por `totalR1Agendada` que ja vem corretamente da RPC `get_sdr_metrics_from_agenda`, filtrada pelos SDRs do squad consorcio.

## Detalhes tecnicos

### Arquivo: `src/pages/bu-consorcio/PainelEquipe.tsx`

**Linha 412** - dayValues.r1Agendada:
```
// DE:
r1Agendada: (dayKPIs?.totalRealizadas || 0) + (dayKPIs?.totalNoShows || 0) + dayPendentes,
// PARA:
r1Agendada: dayKPIs?.totalR1Agendada || 0,
```

**Linha 423** - weekValues.r1Agendada:
```
// DE:
r1Agendada: (weekKPIs?.totalRealizadas || 0) + (weekKPIs?.totalNoShows || 0),
// PARA:
r1Agendada: weekKPIs?.totalR1Agendada || 0,
```

**Linha 434** - monthValues.r1Agendada:
```
// DE:
r1Agendada: (monthKPIs?.totalRealizadas || 0) + (monthKPIs?.totalNoShows || 0),
// PARA:
r1Agendada: monthKPIs?.totalR1Agendada || 0,
```

Essas 3 alteracoes garantem que R1 Agendada use a fonte de verdade (RPC filtrada por squad) em vez de formulas manuais com dados de outras BUs.
