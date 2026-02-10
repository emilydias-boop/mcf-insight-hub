
# Painel da Equipe - Consorcio

## Objetivo
Replicar o Painel Comercial do Incorporador (`/crm/reunioes-equipe`) para a BU Consorcio (`/consorcio/painel-equipe`), exibindo SDRs e Closers do consorcio com as mesmas funcionalidades: card de metricas monetarias, metas da equipe, filtros de periodo, KPI cards, tabelas de SDRs e Closers.

## Problemas identificados nos dados
Antes de implementar, e importante notar que varios SDRs e Closers do consorcio na tabela `sdr` estao **sem email** (campo nulo), o que impedira que suas metricas da agenda sejam vinculadas. Sera necessario corrigir esses registros.

## Mudancas necessarias

### 1. Parametrizar `useTeamMeetingsData` por BU
Atualmente o hook usa `useSdrsFromSquad('incorporador')` fixo. Adicionar um parametro `squad` (default `'incorporador'`) para que o Consorcio passe `'consorcio'`.

### 2. Parametrizar `TeamGoalsPanel` e `useSdrTeamTargets` por BU
As metas da equipe usam prefixo `sdr_` na tabela `team_targets`. Para o Consorcio, sera necessario usar um prefixo diferente (ex: `consorcio_sdr_`) ou filtrar por um campo de BU. A abordagem mais simples e criar metas com prefixo `consorcio_sdr_*` e parametrizar o hook.

### 3. Card de metricas monetarias do Consorcio
Em vez do `IncorporadorMetricsCard`, criar um `ConsorcioMetricsCard` que usa os dados do setor `efeito_alavanca` e/ou `credito` do `useSetoresDashboard`.

### 4. Implementar a pagina `PainelEquipe.tsx` do Consorcio
Reutilizar a mesma estrutura do `ReunioesEquipe.tsx` mas com:
- `squad = 'consorcio'` para SDRs
- `bu = 'consorcio'` para Closers (ja suportado pelo `useR1CloserMetrics`)
- Card monetario do Consorcio
- Metas da equipe com prefixo de BU

### 5. Hooks a modificar
- **`useTeamMeetingsData.ts`**: Aceitar parametro `squad` (default `'incorporador'`)
- **`useSdrTeamTargets.ts`**: Aceitar parametro `buPrefix` opcional para filtrar metas por BU
- **`TeamGoalsPanel.tsx`**: Aceitar prop `bu` para passar ao hook de metas

### 6. Componentes reutilizados sem alteracao
- `TeamKPICards` - generico, funciona com qualquer dados
- `SdrSummaryTable` - generico
- `CloserSummaryTable` - generico
- `GoalsMatrixTable` - generico
- `SetorRow` - generico

## Detalhes tecnicos

### Estrutura de arquivos
```text
Modificados:
  src/hooks/useTeamMeetingsData.ts    (adicionar param squad)
  src/hooks/useSdrTeamTargets.ts      (adicionar param buPrefix)
  src/components/sdr/TeamGoalsPanel.tsx (aceitar bu prop)
  src/pages/bu-consorcio/PainelEquipe.tsx (implementar pagina completa)
```

### Fluxo de dados
```text
PainelEquipe (consorcio)
  |-- ConsorcioMetricsCard (useSetoresDashboard -> setor efeito_alavanca/credito)
  |-- TeamGoalsPanel (bu='consorcio' -> useSdrTeamTargets com prefixo consorcio_sdr_)
  |-- useTeamMeetingsData (squad='consorcio') -> SDRs + metricas
  |-- useR1CloserMetrics (bu='consorcio') -> Closers (ja suportado)
  |-- TeamKPICards, SdrSummaryTable, CloserSummaryTable (reuso direto)
```

### Correcao de dados pendente
Inserir emails faltantes nos registros da tabela `sdr` para os SDRs do Consorcio (Ithaline, Luis Felipe, Ygor, etc.) para que o sistema de metricas consiga vincular corretamente.
