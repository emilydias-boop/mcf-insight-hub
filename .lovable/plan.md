

## Corrigir Metas Individuais no Gráfico "Evolução Dia a Dia"

### Problema

As metas individuais no gráfico estão sendo calculadas dividindo a meta do time pelo número de membros (ex: 72 / 21 = 3.43). Mas cada pessoa tem sua própria `meta_diaria` na tabela `sdr` (ex: Carol Correa = 10/dia). O valor mostrado no gráfico precisa vir dessa meta individual.

### Lógica da `meta_diaria`

- `meta_diaria` = meta de **agendamento** por dia (tabela `sdr`)
- Meta de **realizadas** = 70% da meta de agendadas (padrão do sistema)
- Quando "Todos" está selecionado, manter o comportamento atual (meta do time vinda de `team_targets`)

### Alterações

| Arquivo | O que muda |
|---|---|
| `src/components/relatorios/InvestigationReportPanel.tsx` | Buscar `meta_diaria` da tabela `sdr` pelo email da pessoa selecionada. Quando individual, usar `meta_diaria` como `agendadas` e `meta_diaria * 0.7` como `realizadas`, em vez de dividir team target por member count. |

### Detalhes

1. **Novo query**: Quando `selectedId` muda e não é `__all__`, buscar o email da pessoa (via `closers` ou `employees`) e depois buscar `sdr.meta_diaria` pela correspondência de email.

2. **Simplificação**: Usar `useQuery` direto no painel para buscar o `sdr` record da pessoa selecionada. Para SDRs, buscar `employees.email` → `sdr.meta_diaria`. Para closers, usar `closers.email` → `sdr.meta_diaria`.

3. **Cálculo dos dailyTargets individuais**:
   - `agendadas = sdr.meta_diaria` (ex: 10 para Carol Correa)
   - `realizadas = Math.round(sdr.meta_diaria * 0.7)` (ex: 7)
   - `contratosPagos` mantém a lógica de team target dividido (ou remove a reference line)

4. **Quando "Todos"**: mantém o comportamento atual com `teamDailyTargets` do `team_targets`.

