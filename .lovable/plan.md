

# Nova Aba "Aquisicao e Origem" na Central de Relatorios

## Objetivo

Adicionar uma quarta aba chamada **"Aquisicao e Origem"** ao modulo de Relatorios do BU Incorporador, sem alterar as 3 abas existentes (Contratos, Vendas, Desempenho).

Essa aba consolida o faturamento por **Closer**, **SDR**, **Canal**, **Outside** e **Origem/Produto** para analise semanal da diretoria.

## O que sera feito

### 1. Atualizar o tipo `ReportType`

Adicionar `'acquisition'` ao tipo existente em `ReportTypeSelector.tsx` e incluir a nova opcao visual (icone + descricao) no array de opcoes.

### 2. Incluir a nova aba no BU Incorporador

No arquivo `src/pages/bu-incorporador/Relatorios.tsx`, adicionar `'acquisition'` ao array `availableReports`.

### 3. Criar o componente `AcquisitionReportPanel`

Novo arquivo: `src/components/relatorios/AcquisitionReportPanel.tsx`

Este componente reaproveita a mesma logica de dados do `SalesReportPanel` (transacoes, attendees, closers, deduplicacao) e adiciona as dimensoes extras.

**Filtros** (mesmo padrao visual):
- Periodo (DateRange)
- Buscar (texto)
- Fonte (Hubla/Make)
- Closer
- Pipeline
- Canal (A010/BIO/LIVE)
- Produto/Origem (novo)

**KPI Cards** (4 cards no topo):
- Total de Transacoes
- Faturamento Bruto
- Receita Liquida
- Ticket Medio

**Tabelas de analise** (5 blocos):

| Bloco | Colunas |
|---|---|
| Faturamento por Closer | Closer, Transacoes, Fat. Bruto, Receita Liq., Ticket, % Total, Outside, Fat. Outside |
| Faturamento por SDR | SDR, Transacoes, Fat. Bruto, Receita Liq., Ticket, % Total |
| Faturamento por Canal | Canal, Transacoes, Fat. Bruto, Receita Liq., Ticket, % Total |
| Faturamento Outside | Closer, Qtde Outside, Fat. Outside |
| Faturamento por Origem/Produto | Origem, Transacoes, Fat. Bruto, Receita Liq., Ticket, % Total |

**Exportacao Excel**: Botao que exporta todas as dimensoes em abas separadas do Excel.

### 4. Logica de classificacao por dimensao

**Closer**: Reutiliza a mesma logica do `CloserRevenueSummaryTable` -- match por email/telefone com attendees da agenda.

**SDR**: Busca o `owner` do `crm_deal` vinculado ao attendee. O SDR e o dono do deal (quem agendou a reuniao).

**Canal**: Detectado pelo `product_name` (A010/BIO/LIVE) e complementado com `utm_source` quando disponivel.

**Origem/Produto**: Classificacao baseada em `product_category` e `sale_origin`:
- Lancamento: `sale_origin = 'launch'` ou nome contendo "contrato mcf"
- A010: `product_category = 'a010'`
- Renovacao: `product_category = 'renovacao'`
- Vitalicio: `product_category = 'ob_vitalicio'`
- Contrato: `product_category = 'contrato'`
- Outros: restante

**Outside**: Vendas onde `sale_date < scheduled_at` do meeting (venda antes da reuniao).

### 5. Hook de dados

Novo hook: `src/hooks/useAcquisitionReport.ts`

Centraliza a busca e classificacao, retornando dados prontos para cada dimensao. Reutiliza:
- `useAllHublaTransactions` para transacoes
- `useGestorClosers` para closers R1
- Attendees com SDR via query estendida (incluindo `owner` do deal)
- `get_first_transaction_ids` para deduplicacao

### 6. Conectar no BUReportCenter

Adicionar o render condicional para `selectedReport === 'acquisition'` no `BUReportCenter.tsx`.

## Alteracoes Tecnicas

| Arquivo | Alteracao |
|---|---|
| `src/components/relatorios/ReportTypeSelector.tsx` | Adicionar `'acquisition'` ao tipo e ao array de opcoes |
| `src/components/relatorios/BUReportCenter.tsx` | Adicionar render para `selectedReport === 'acquisition'` |
| `src/pages/bu-incorporador/Relatorios.tsx` | Adicionar `'acquisition'` ao `availableReports` |
| `src/hooks/useAcquisitionReport.ts` | **Novo** - Hook que busca transacoes + attendees + SDRs e classifica por dimensao |
| `src/components/relatorios/AcquisitionReportPanel.tsx` | **Novo** - Painel com filtros, KPIs e 5 tabelas de analise |

## Layout Visual

Segue exatamente o padrao atual da aba "Vendas":

```text
[Contratos] [Vendas] [Desempenho] [Aquisicao & Origem]  <-- nova aba

+-- Filtros (Card) ------------------------------------------+
| Periodo  Buscar  Fonte  Closer  Pipeline  Canal  [Excel]   |
+------------------------------------------------------------+

+-- KPI Cards (4 colunas) ----------------------------------+
| Total Transacoes | Fat. Bruto | Receita Liq. | Ticket Med |
+------------------------------------------------------------+

+-- Faturamento por Closer (Table) -------------------------+
| Closer | Txns | Bruto | Liq. | Ticket | % | Outside | F.O |
+------------------------------------------------------------+

+-- Faturamento por SDR (Table) ----------------------------+
| SDR | Txns | Bruto | Liq. | Ticket | %                   |
+------------------------------------------------------------+

+-- Faturamento por Canal (Table) --------------------------+
| Canal | Txns | Bruto | Liq. | Ticket | %                 |
+------------------------------------------------------------+

+-- Faturamento Outside (Table) ----------------------------+
| Closer | Qtde Outside | Fat. Outside                     |
+------------------------------------------------------------+

+-- Faturamento por Origem/Produto (Table) -----------------+
| Origem | Txns | Bruto | Liq. | Ticket | %                |
+------------------------------------------------------------+
```

## Notas Importantes

- Nenhuma funcionalidade existente sera removida ou alterada
- A aba so aparece no BU Incorporador (as outras BUs mantem seus relatorios atuais)
- O padrao visual e identico ao existente (cards escuros, tabelas padrao, tipografia atual)
- Sem migracoes SQL necessarias -- todos os dados ja existem no banco
- A logica de deduplicacao e outside segue a mesma hierarquia ja documentada
