

## Auditoria Completa: Painel Comercial (Incorporador)

### Fluxo Verificado

O Painel Comercial (`/crm/reunioes-equipe`) é composto por:
1. **Card MCF Incorporador** (faturamento semanal/mensal/anual)
2. **Metas da Equipe** (matriz Dia/Semana/Mês com 8 métricas)
3. **Filtros** (Hoje/Semana/Mês/Custom + filtro SDR + Exportar)
4. **KPI Cards** (SDRs Ativos, Agendamentos, Realizadas, No-Shows, Contratos, Taxas)
5. **Tabela SDRs** (com clique → detalhe individual)
6. **Tabela Closers** (com clique → detalhe individual)
7. **Tabela Atividades SDR**

---

### Problemas Encontrados

#### 1. Visão Individual do SDR: dados desatualizados na fonte
**Arquivo:** `src/hooks/useSdrDetailData.ts`
- O hook usa `useTeamMeetingsData` que busca da RPC `get_sdr_metrics_from_agenda` para métricas e `get_sdr_meetings_from_agenda` para reuniões. Porém, o filtro `getMeetingsForSDR` (linha 136) compara por `current_owner`, que pode divergir do `booked_by` (SDR que agendou). Isso pode omitir reuniões onde o SDR agendou mas o deal foi transferido para um closer.
- **Impacto**: SDR pode ver menos reuniões do que realmente agendou.

#### 2. SDR Detail: SdrRankingBlock sem coluna "Vendas Parceria"
**Arquivo:** `src/components/sdr/SdrRankingBlock.tsx`
- O ranking mostra Agendamentos, R1 Agendada, R1 Realizada, Contratos e Taxa Contrato.
- Não mostra "Vendas Parceria" nem "Outside" que são métricas relevantes para comparação.
- **Impacto**: Menor visibilidade de métricas complementares.

#### 3. SdrSummaryTable: "Taxa Conv." calcula R1 Realizada / R1 Agendada (conversão de comparecimento)
**Arquivo:** `src/components/sdr/SdrSummaryTable.tsx` (linhas 97-100)
- A coluna "Taxa Conv." mostra `R1 Realizada / R1 Agendada` (taxa de comparecimento), não taxa de contrato.
- A coluna "Taxa Contrato" mostra `Contratos / R1 Realizada` (taxa de fechamento).
- **Ambas estão corretas**, mas o nome "Taxa Conv." pode confundir. Considerar renomear para "Taxa Presença" ou "% Compareceu".

#### 4. Closer Detail: aba "Leads Realizados" filtra apenas `completed` e `contract_paid`
**Arquivo:** `src/hooks/useCloserDetailData.ts` (linhas 138-156)
- O query dos leads do closer filtra apenas status `completed` e `contract_paid`, ignorando `no_show`. Isso significa que a aba "Leads Realizados" não mostra no-shows, o que é correto pelo nome, mas o closer perde visibilidade dos no-shows individuais.
- **Sugestão**: Adicionar aba ou filtro para ver também os no-shows.

#### 5. Closer Detail: falta aba de R2 Agendadas
**Arquivo:** `src/pages/crm/CloserMeetingsDetailPage.tsx`
- O closer detail tem "Visão Geral", "Leads Realizados" e "Faturamento".
- Não há visão dos leads de R2 agendados pelo closer. O KPI mostra "R2 Agendadas" mas não há drill-down.

#### 6. SDR Detail: `useSdrDeals` usa `owner_id` como email
**Arquivo:** `src/hooks/useSdrDeals.ts` (linha 28)
- O filtro `.eq('owner_id', ownerEmail)` assume que `owner_id` armazena email. Isso está correto conforme o schema do CRM, mas deals transferidos para closers (onde `owner_id` muda) não aparecerão mais na aba "Todos os Negócios" do SDR original.
- **Impacto**: SDR perde visibilidade de deals que foram transferidos.

#### 7. Goals Panel: metas sempre buscam Dia/Semana/Mês do momento atual
**Arquivo:** `src/pages/crm/ReunioesEquipe.tsx` (linhas 159-170, 186-253)
- As queries `dayKPIs`, `weekKPIs` e `monthKPIs` para o GoalsPanel sempre usam `today`, independente do filtro selecionado. Isso é **correto** (o painel de metas mostra o progresso atual), mas pode confundir quando o filtro está em outro mês.

#### 8. Exportar Excel: não inclui dados de Closers
**Arquivo:** `src/pages/crm/ReunioesEquipe.tsx` (linhas 374-411)
- A exportação gera apenas "Resumo SDR" e "Leads Detalhados". Quando a aba "Closers" está selecionada, o botão exporta dados de SDR mesmo assim.
- **Sugestão**: Exportar dados da aba ativa (SDRs ou Closers).

---

### Sugestões de Melhoria

1. **Renomear "Taxa Conv." para "% Presença"** na tabela SDR para evitar confusão com "Taxa Contrato"
2. **Adicionar aba de No-Shows no Closer Detail** para dar visibilidade individual dos leads que não compareceram
3. **Exportação contextual**: detectar aba ativa (SDRs/Closers) e exportar os dados correspondentes
4. **SDR Detail**: considerar mostrar reuniões por `booked_by` (quem agendou) além de `current_owner` para não perder visibilidade após transferências
5. **Closer Detail**: adicionar drill-down de R2 Agendadas

---

### Dados Corretos (validados)

- KPI Cards somam corretamente os dados filtrados por squad `incorporador`
- No-Show = R1 Agendada - R1 Realizada (consistente com a regra de negócio documentada)
- Taxa Conversão Closer = Contrato Pago / R1 Realizada (correto)
- Taxa No-Show Closer = No-Show / R1 Agendada (correto)
- Ranking por SDR e Closer calculam posições corretamente
- Filtros de período (Hoje/Semana/Mês/Custom) propagam corretamente via URL params para detalhes
- Navegação ida-volta (lista → detalhe → lista) preserva filtros

