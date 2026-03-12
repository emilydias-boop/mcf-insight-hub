

## Nova aba "Histórico de Compras" no Relatório do Consórcio

O objetivo é criar uma nova aba de relatório que cruza os leads do Consórcio (tabela `consortium_cards`) com o histórico completo de compras em todas as BUs (tabela `hubla_transactions`), exibindo dados de contato e todas as transações associadas.

### 1. Novo ReportType: `cross_history`

**`src/components/relatorios/ReportTypeSelector.tsx`**
- Adicionar `'cross_history'` ao type `ReportType`
- Adicionar opção com ícone `Users` (ou `History`), título "Histórico Parceiros", descrição "Compras cross-BU dos leads"

### 2. Novo componente: `CrossHistoryReportPanel.tsx`

**`src/components/relatorios/CrossHistoryReportPanel.tsx`**

Hook de dados (`useQuery`):
1. Buscar emails únicos de `consortium_cards` (campo `email`) — são os leads do Consórcio
2. Com esses emails, buscar todas as transações em `hubla_transactions` (cross-BU, sem filtro de BU)
3. Também buscar dados de contato: `nome_completo`, `email`, `telefone` de `consortium_cards`

UI:
- Filtros: Busca por nome/email, período (DateRange), filtro por produto
- KPI cards: Total de leads com compras, Total de transações, Faturamento bruto total
- Tabela principal com colunas: **Cliente** (nome + email + telefone), **Produto**, **Data**, **Bruto**, **Líquido**, **Parcela**, **Fonte**, **Tipo** (Novo/Recorrente), **Status**
- Agrupamento visual por cliente (ou flat com cliente repetido)
- Botão de exportar Excel
- Paginação

### 3. Registrar no BUReportCenter

**`src/components/relatorios/BUReportCenter.tsx`**
- Importar `CrossHistoryReportPanel`
- Adicionar case `selectedReport === 'cross_history'`

**`src/pages/bu-consorcio/Relatorio.tsx`**
- Adicionar `'cross_history'` ao array `availableReports`

### Fluxo de dados

```text
consortium_cards (email) ──► hubla_transactions (customer_email)
       │                              │
       └─ nome, email, telefone       └─ product_name, product_price,
                                         net_value, sale_date, source,
                                         installment_number, sale_status
```

A query busca todos os emails de `consortium_cards`, depois faz `hubla_transactions.in('customer_email', emails)` para trazer o histórico completo cross-BU. Isso mostra exatamente o que o usuário quer: quem comprou consórcio E o que mais comprou nas outras BUs (parceria, contrato, A010, etc).

