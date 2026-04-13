

# Plano: Unificar fonte de dados dos KPIs com a tabela de SDRs

## Problema
Os KPIs do topo são sobrescritos com dados vindos de `useR1CloserMetrics` (perspectiva closer), enquanto a tabela de SDRs mostra dados de `useSdrMetricsFromAgenda` (perspectiva SDR). Isso gera números conflitantes: No-Shows 105 (closer) vs 189 (SDR).

## Causa técnica
Em `ReunioesEquipe.tsx` linhas 317-331, o `enrichedKPIs` substitui `totalNoShows`, `totalRealizadas`, `totalContratos` e taxas com valores dos closers, mas a tabela continua usando `bySDR` da RPC do SDR.

## Solução proposta

### Opção A — KPIs seguem a aba ativa
Quando a aba "SDRs" está selecionada, os KPIs usam os totais da tabela de SDRs (`teamKPIs`). Quando a aba "Closers" está selecionada, usam os totais dos closers (`r1FromClosers`). Isso é o mesmo padrão já usado no Painel de Equipe do Consórcio (conforme memória `bu-consorcio-kpi-alignment-logic`).

### Alterações

**`src/pages/crm/ReunioesEquipe.tsx`**:
1. Manter o `enrichedKPIs` como está (dados de closer)
2. Criar um `sdrKPIs` que use os totais da tabela de SDRs (já existem em `teamKPIs`)
3. Passar para `TeamKPICards` o KPI correto baseado na aba ativa (`activeTab === 'sdrs' ? sdrKPIs : enrichedKPIs`)

### Resultado
- Aba SDRs: KPIs = 363 agendamentos, 189 no-shows, taxa ~51% — consistente com a tabela
- Aba Closers: KPIs = dados dos closers (105 no-shows, 29.7%) — consistente com a tabela de closers
- Zero inconsistência visual

