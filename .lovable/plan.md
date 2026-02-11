
# Fix: R1 Agendada mostrando valor duplicado (126 em vez de 66)

## Causa raiz

No calculo do `dayValues.r1Agendada` na pagina `ReunioesEquipe.tsx` (linha 318), a formula atual e:

```text
r1Agendada = Realizadas + NoShows + Pendentes
```

O problema e que `NoShows` agora vem da RPC como `R1_Agendada - R1_Realizada`. Substituindo:

```text
r1Agendada = Realizadas + (R1_Agendada_RPC - Realizadas) + Pendentes
           = R1_Agendada_RPC + Pendentes
```

Como `R1_Agendada_RPC` ja inclui as reunioes pendentes (todas com `status != cancelled`), o valor de `Pendentes` esta sendo somado duas vezes. Resultado: 66 (real) + 60 (pendentes duplicados) = 126.

## Solucao

Usar diretamente o `r1_agendada` da RPC via `teamKPIs`, em vez de recalcular. O hook `useTeamMeetingsData` ja acumula `totalR1Agendada` internamente, mas nao o expoe no objeto `teamKPIs`.

### Alteracoes necessarias

**1. `src/hooks/useTeamMeetingsData.ts`**
- Adicionar campo `totalR1Agendada` ao interface `TeamKPIs`
- Expor `totalR1Agendada` no objeto retornado (ja e calculado na linha 100, so precisa ser adicionado ao retorno)

**2. `src/pages/crm/ReunioesEquipe.tsx`**
- Linha 318 (dayValues): trocar de `(dayKPIs?.totalRealizadas || 0) + (dayKPIs?.totalNoShows || 0) + dayPendentes` para `dayKPIs?.totalR1Agendada || 0`
- Linha 329 (weekValues): trocar de `(weekKPIs?.totalRealizadas || 0) + (weekKPIs?.totalNoShows || 0)` para `weekKPIs?.totalR1Agendada || 0`
- Linha 340 (monthValues): trocar de `(monthKPIs?.totalRealizadas || 0) + (monthKPIs?.totalNoShows || 0)` para `monthKPIs?.totalR1Agendada || 0`
- Remover a dependencia de `dayPendentes` do calculo de `r1Agendada` (pode manter o hook para outros usos se necessario)

### Resultado esperado

- DIA: R1 Agendada mostrara o numero real de reunioes agendadas para hoje (~66)
- SEMANA/MES: valores tambem serao consistentes com a RPC
- No-Show continuara sendo `R1 Agendada - R1 Realizada`, agora com a base correta

## Secao tecnica

```text
-- Interface TeamKPIs (adicionar campo)
totalR1Agendada: number;

-- teamKPIs object (adicionar ao retorno, linha ~106)
totalR1Agendada,

-- dayValues (simplificado)
r1Agendada: dayKPIs?.totalR1Agendada || 0,

-- weekValues
r1Agendada: weekKPIs?.totalR1Agendada || 0,

-- monthValues
r1Agendada: monthKPIs?.totalR1Agendada || 0,
```

Nenhuma alteracao no banco de dados. Apenas 2 arquivos frontend afetados.
