

## Metas proporcionais no dashboard individual do SDR

### Problema

No dashboard individual (`/crm/reunioes-equipe/:sdrEmail`), a meta de Agendamentos usa `metaDiaria × diasUteisNoPeriodo` com os dias úteis cheios do período. Para SDRs que entraram no meio do mês (ex: Mayara com meta 110 quando deveria ser proporcional), a meta deveria considerar apenas os dias a partir da `data_admissao`.

### Solução

Buscar `data_admissao` do employee vinculado ao SDR e ajustar `businessDaysTotal` para contar apenas dias úteis a partir da admissão (quando posterior ao início do período).

### Mudanças

#### 1. `src/hooks/useSdrDetailData.ts` — Expor `data_admissao`

- Na query `metaDiariaQuery`, buscar também o `employee_id` do SDR e depois a `data_admissao` do employee vinculado (ou adicionar uma query separada)
- Expor `dataAdmissao: string | null` no retorno de `SdrDetailData`

#### 2. `src/hooks/useSdrPerformanceData.ts` — Ajustar `businessDaysTotal` e `metaPeriodo`

- Usar `detail.dataAdmissao` para calcular `inicioEfetivo = max(startDate, dataAdmissao)`
- Recalcular `businessDaysTotal` como `contarDiasUteis(inicioEfetivo, endDate)` quando admissão é posterior ao início do período
- Isso automaticamente propaga para: `metaPeriodo`, `metas.ligacoesMeta`, `projection`, `dailyRows` e `summaryText`
- Adicionar indicador no summaryText quando proporcional (ex: "meta proporcional de X agendamentos (Y dias úteis)")

### Resultado

- Meta de Mayara: `5/dia × 16 dias = 80` em vez de `5/dia × 22 dias = 110`
- Projeção, ligações e todos os KPIs derivados acompanham automaticamente
- Sem mudanças no backend — apenas leitura de `data_admissao` já existente

### Arquivos alterados
1. `src/hooks/useSdrDetailData.ts` — buscar e expor `dataAdmissao`
2. `src/hooks/useSdrPerformanceData.ts` — ajustar dias úteis com base na admissão

