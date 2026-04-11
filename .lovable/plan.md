

# Plano: Funil Pós-Venda com Gráficos de Pizza

## Contexto

O relatório "Análise de Carrinho" atual já rastreia a jornada do lead desde A010 até parceria, mas de forma tabular. O pedido é criar uma **visualização em funil com gráficos de pizza** mostrando o destino de cada contrato pago após a venda, com drill-down por etapa.

## Onde ficará

Na página de **Relatórios** (`/bu-incorporador/relatorios`), substituindo/evoluindo o relatório "Análise de Carrinho" existente. Faz sentido manter aqui pois é uma análise analítica e não operacional (Cobranças foca em fluxo de caixa).

## Alterações

### 1. Migração de banco: novos campos

Adicionar à tabela `hubla_transactions` (ou criar tabela auxiliar `contract_pos_venda_status`):

- `status_pos_venda` (enum): `desistiu_antes_r2`, `nao_responde`, `tentando_agendar`, `agendado`, `r2_realizada`, `no_show`, `desistiu_apos_r2`, `aprovado`
- `sub_status_pos_venda` (text nullable): valores livres como `carrinho_01_04`, `data_agendada`, etc.

**Recomendação**: criar uma tabela separada `contract_post_sale_tracking` com FK para `hubla_transactions.id`, para não poluir a tabela de transações. Campos: `id`, `transaction_id` (unique FK), `status_pos_venda`, `sub_status`, `updated_at`, `updated_by`.

### 2. Hook: `usePostSaleFunnel`

- Busca contratos pagos no período (reusa lógica do `useCarrinhoAnalysisReport`)
- Cruza com a nova tabela `contract_post_sale_tracking` para obter status manual
- Para contratos SEM status manual, **calcula automaticamente** o status baseado nos dados existentes (R2 agendada? Realizada? Aprovado? etc.) -- igual o hook atual já faz
- Retorna dados agrupados para pie chart + drill-down

### 3. Componente: `PostSaleFunnelChart`

- **Gráfico de pizza principal**: agrupa contratos por `status_pos_venda`
- Cores distintas por status (verde=aprovado, vermelho=desistiu, amarelo=agendado, etc.)
- **Drill-down**: ao clicar numa fatia, abre painel com:
  - Sub-agrupamento por `sub_status` (ex: dentro de "R2 Realizada" -> carrinho_01_04, carrinho_10_04)
  - Lista dos leads naquele status
- Usa `recharts` (PieChart) já disponível no projeto

### 4. Componente: `PostSaleFunnelPanel`

Painel completo com:
- Seletor de período (semana/mês/personalizado) -- reusa do CarrinhoAnalysis
- KPI cards resumidos (total contratos, % agendados, % aprovados)
- Gráfico de pizza principal
- Área de drill-down condicional
- Tabela de detalhes dos leads da fatia selecionada

### 5. Integração no `CarrinhoAnalysisReportPanel`

Adicionar uma nova aba ou seção "Funil Pós-Venda" dentro do relatório de Análise de Carrinho existente, mantendo a tabela detalhada atual e adicionando a visualização em pizza.

### 6. Atualização do `BUReportCenter`

Registrar o novo painel ou integrá-lo ao relatório `carrinho_analysis` existente.

## Detalhes Técnicos

- **Tabela**: `contract_post_sale_tracking` com RLS para authenticated
- **Enum PostgreSQL**: `contract_pos_venda_status` com os 8 valores
- **Auto-classificação**: O hook calcula o status automaticamente dos dados existentes (R2, parceria, reembolso) quando não há override manual, eliminando necessidade de preencher manualmente cada contrato
- **Recharts PieChart**: já usado em `CostsDistributionChart.tsx` como referência de implementação
- **Drill-down**: state local `selectedSlice` que filtra a lista ao clicar na fatia

## Fluxo do usuário

1. Abre Relatórios > Análise de Carrinho
2. Seleciona período (semana)
3. Vê gráfico de pizza com distribuição dos contratos por status
4. Clica em "Agendados" (fatia)
5. Vê sub-distribuição: R2 realizada, agendado futuro, no-show, desistência
6. Clica em "R2 Realizada"
7. Vê separação por carrinho (carrinho_01/04, carrinho_10/04)

