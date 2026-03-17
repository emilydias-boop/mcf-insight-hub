

## Metas individuais no painel de Investigacao

### Problema

As metas em `team_targets` sao do TIME inteiro (ex: `sdr_contrato_dia = 18` para 12 closers). Quando seleciona "Carol Souza", o grafico mostra a meta de 18 contratos/dia como referencia -- mas a meta individual dela seria `18 / 12 = 1.5 contratos/dia`. Alem disso, na tabela comparativa a coluna "% Meta" tambem usa a meta total do time, nao a individual.

### Solucao

#### 1. Calcular meta individual por pessoa (`InvestigationReportPanel.tsx`)

- Contar o numero de membros ativos: closers ativos (do hook `useGestorClosers`) ou SDRs ativos (do hook `useGestorSDRs`)
- Quando um individuo esta selecionado (`selectedId !== '__all__'`):
  - `metaIndividual = metaTime / numMembros`
  - Passar essa meta individual como `dailyTargets` para o grafico de evolucao e tabela
- Quando "Todos" esta selecionado:
  - Manter a meta do time inteiro como esta

Logica:
```
const memberCount = selectedType === 'closer' ? closers.length : sdrs.length;
const individualDailyTargets = isAll ? dailyTargets : {
  agendadas: dailyTargets.agendadas ? dailyTargets.agendadas / memberCount : undefined,
  realizadas: dailyTargets.realizadas ? dailyTargets.realizadas / memberCount : undefined,
  contratosPagos: dailyTargets.contratosPagos ? dailyTargets.contratosPagos / memberCount : undefined,
};
```

#### 2. Atualizar props passadas aos componentes

- `InvestigationEvolutionChart`: passar `individualDailyTargets` em vez de `dailyTargets` -- as `ReferenceLine` vao mostrar a meta individual (ex: 1.5/dia)
- `InvestigationComparisonTable`: passar `individualDailyTargets` e `daysInPeriod` -- a coluna "% Meta" vai calcular `contratosPagos / (metaIndividual * dias) * 100`
- Cards de "Atingimento de Meta": quando individual, mostrar progresso vs meta individual do periodo; quando "Todos", manter meta total

#### 3. Melhorar label das reference lines no grafico

- Mostrar "Meta Ind." quando individual, "Meta Time" quando todos
- Formatar com 1 casa decimal quando meta individual nao for inteira (ex: "Meta Ind. 1.5")

### Arquivos a editar

| Arquivo | Acao |
|---|---|
| `src/components/relatorios/InvestigationReportPanel.tsx` | Calcular meta individual dividindo pelo numero de membros, passar props corretas |
| `src/components/relatorios/InvestigationEvolutionChart.tsx` | Ajustar labels das reference lines para distinguir meta individual vs time |

Nenhum arquivo novo. Alteracoes concentradas no painel principal e label do grafico.

