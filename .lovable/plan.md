

## Objetivo

Transformar a aba "Leads Realizados" do "Meu Desempenho" em uma visão completa de **todos os leads** do closer (realizados, no-shows, contrato pago, agendados), com filtros por status e exportação Excel para facilitar follow-up.

## Mudanças

### 1. Página `MeuDesempenhoCloser.tsx`

- Renomear aba de "Leads Realizados" para "Meus Leads"
- Combinar `leads` + `noShowLeads` + leads agendados (buscar do hook) em uma lista unificada
- Passar todos os leads para o componente de tabela atualizado
- O hook `useCloserDetailData` já retorna `leads`, `noShowLeads` e `r2Leads` — basta usá-los

### 2. Hook `useCloserDetailData.ts`

- Adicionar query para buscar leads **agendados** (status `scheduled`, `rescheduled`) do closer no período — atualmente só busca `completed`/`contract_paid` e `no_show` separadamente
- Criar uma propriedade `allLeads` que concatena leads realizados + no-shows + agendados

### 3. Componente `CloserLeadsTable.tsx` → Refatorar para "Meus Leads"

- Adicionar **filtro por status** (Select dropdown): Todos, Realizada, Contrato Pago, No-Show, Agendada
- Adicionar **botão Exportar Excel** usando a lib `xlsx` já instalada
  - Colunas: Data, Nome, Telefone, Email, Status, SDR, Origem
- Adicionar contadores por status no topo (badges)
- Filtro client-side sobre a lista combinada

### 4. Dados exportados no Excel

| Data | Nome | Telefone | Email | Status | SDR | Origem |
|------|------|----------|-------|--------|-----|--------|

Formato de data: `dd/MM/yyyy HH:mm`

## Resultado

O closer verá todos os seus leads em uma única tabela filtrada, podendo identificar rapidamente no-shows para follow-up e exportar a lista completa para trabalho offline.

