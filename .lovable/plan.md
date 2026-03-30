

## Metas proporcionais para novos colaboradores no Painel de Equipe

### Escopo

Aplicar metas proporcionais **apenas para SDRs ativos** que entraram no meio do mês (ex: Mayara, Marcio). Desligados **NÃO** aparecem neste painel -- a filtragem existente por `sdr.active = true` já garante isso.

### Mudanças

#### 1. `src/pages/crm/ReunioesEquipe.tsx` — Buscar `data_admissao` e calcular dias efetivos por SDR

- Após obter `activeSdrsList`, buscar `employees` vinculados para pegar `data_admissao`
- Calcular um `sdrDiasUteisMap: Map<string, number>` para cada SDR ativo:
  - `inicioEfetivo = max(startDate, data_admissao)` 
  - Contar dias úteis (seg-sex) de `inicioEfetivo` até `endDate`
  - Se `data_admissao` for anterior ao `startDate`, dias efetivos = `diasUteisNoPeriodo` (sem ajuste)
- Passar `sdrDiasUteisMap` para o `SdrSummaryTable`

#### 2. `src/components/sdr/SdrSummaryTable.tsx` — Usar dias efetivos individuais

- Nova prop: `sdrDiasUteisMap?: Map<string, number>`
- Na renderização de cada row:
  ```
  const diasEfetivos = sdrDiasUteisMap?.get(row.sdrEmail.toLowerCase()) || diasUteisNoPeriodo || 1;
  const metaPeriodo = metaDiaria * diasEfetivos;
  ```
- Quando `diasEfetivos < diasUteisNoPeriodo`, exibir badge sutil (ex: "10/22d") ao lado da meta

#### 3. `src/pages/bu-consorcio/PainelEquipe.tsx` + `ConsorcioSdrSummaryTable.tsx` — Mesma lógica

- Replicar busca de `data_admissao` e cálculo de `sdrDiasUteisMap` no painel Consórcio
- Passar para o `ConsorcioSdrSummaryTable` e aplicar a mesma lógica de meta proporcional

### Resultado

- Mayara/Marcio (admissão no meio do mês) terão meta proporcional (ex: 70 em vez de 110)
- SDRs do mês inteiro permanecem inalterados
- Desligados continuam **não aparecendo** no painel (já filtrados por `active = true`)
- Badge visual "X/Yd" indica quando a meta é proporcional

### Arquivos alterados
1. `src/pages/crm/ReunioesEquipe.tsx`
2. `src/components/sdr/SdrSummaryTable.tsx`
3. `src/pages/bu-consorcio/PainelEquipe.tsx`
4. `src/components/sdr/ConsorcioSdrSummaryTable.tsx`

