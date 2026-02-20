

# Relatório de Produtos Adquiridos - BU Consórcio

## Objetivo

Adicionar uma 5a aba de relatório ("Produtos") na Central de Relatórios da BU Consórcio, que consolida todos os produtos adquiridos registrados nos deals, permitindo filtrar por período, produto e SDR, com exportação para Excel.

## O que será exibido

### KPIs no topo
- Total de produtos registrados (quantidade)
- Valor total dos produtos
- Ticket médio por produto
- Quantidade de leads com pelo menos 1 produto

### Tabela detalhada
Cada linha representa um produto registrado em um deal:
- Lead (nome do deal)
- Contato (nome, email, telefone do contato vinculado)
- SDR (owner do deal)
- Produto (label da opção)
- Valor (R$)
- Data de registro

### Filtros
- Periodo (date range picker)
- Produto (select com as opções ativas)
- Busca por nome do lead/contato

### Exportação Excel
- Botão para exportar a tabela filtrada em .xlsx

## Detalhes Tecnicos

### 1. Novo hook: `src/hooks/useProductsAcquiredReport.ts`
- Faz query em `deal_produtos_adquiridos` com JOIN em `crm_deals`, `crm_contacts` e `consorcio_produto_adquirido_options`
- Filtra por `created_at` no range de datas selecionado
- Retorna lista completa com dados do deal, contato e produto

### 2. Novo componente: `src/components/relatorios/ProductsReportPanel.tsx`
- Recebe `bu: BusinessUnit` como prop (seguindo o padrão existente)
- Implementa filtros, KPIs e tabela paginada
- Exportação Excel via `xlsx`
- Segue o mesmo layout visual dos outros painéis (SalesReportPanel, etc.)

### 3. Atualizar `ReportTypeSelector.tsx`
- Adicionar tipo `'products'` ao `ReportType` union
- Adicionar opção com icone `Package` e descrição "Produtos adquiridos por lead"

### 4. Atualizar `BUReportCenter.tsx`
- Importar e renderizar `ProductsReportPanel` quando `selectedReport === 'products'`

### 5. Atualizar `Relatorio.tsx` (bu-consorcio)
- Adicionar `'products'` ao array `availableReports`

