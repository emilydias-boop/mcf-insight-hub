

## Adicionar tabela "Atividades por SDR" no Painel Equipe do Consorcio

### Contexto

O Painel de Equipe do Incorporador ja possui uma tabela "Atividades por SDR" (`SdrActivityMetricsTable`) que mostra ligacoes, atendidas, notas, movimentos, WhatsApp, leads e lig/lead. O hook `useSdrActivityMetrics` ja aceita um parametro `squad` (default `'incorporador'`), porem o componente `SdrActivityMetricsTable` nao repassa esse parametro.

### Alteracoes

**1. `src/components/sdr/SdrActivityMetricsTable.tsx`**
- Adicionar prop `squad?: string` na interface `SdrActivityMetricsTableProps`
- Passar `squad` para o hook `useSdrActivityMetrics(startDate, endDate, originId, squad)`

**2. `src/pages/bu-consorcio/PainelEquipe.tsx`**
- Importar `SdrActivityMetricsTable`
- Adicionar o componente apos a Card de SDR/Closer Summary Table, visivel quando `activeTab === "sdrs"`
- Passar `startDate={start}`, `endDate={end}`, `squad="consorcio"`

### Resultado

A tabela de atividades aparecera abaixo da tabela de SDRs no painel do Consorcio, filtrando apenas os SDRs da squad `consorcio`, identica visualmente a do Incorporador.

