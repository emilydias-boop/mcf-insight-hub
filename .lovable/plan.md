

# Faturamento por Closer no Relatório de Vendas e Detalhe Individual

## Resumo

Adicionar duas funcionalidades:
1. Uma **tabela resumo por closer** no Relatório de Vendas, mostrando faturamento bruto, líquido, quantidade de transações e ticket médio por closer
2. Uma **aba "Faturamento"** na página de detalhe individual do closer (/crm/reunioes-equipe/closer/:id), com os mesmos dados filtrados para aquele closer específico

## Mudanças

### 1. Novo componente: CloserRevenueSummaryTable

Tabela que agrega as transações por closer, reutilizando o matching já existente no SalesReportPanel (via attendees com contract_paid + email/phone matching).

Colunas da tabela:
- Closer (nome)
- Transações (quantidade)
- Faturamento Bruto (R$)
- Receita Líquida (R$)
- Ticket Médio (R$)
- % do Total

Incluirá uma linha "Sem closer" para transações que não foram atribuídas a nenhum closer, e uma linha "Total" no rodapé.

Arquivo: `src/components/relatorios/CloserRevenueSummaryTable.tsx`

### 2. Alterar SalesReportPanel para exibir a tabela resumo

Inserir o novo componente entre os KPI cards e a tabela de transações, passando as transações filtradas, os closers e os attendees.

Arquivo: `src/components/relatorios/SalesReportPanel.tsx`

### 3. Nova aba "Faturamento" na página de detalhe do closer

Adicionar uma terceira aba ao CloserMeetingsDetailPage que mostra:
- KPI cards de faturamento (Total Transações, Bruto, Líquido, Ticket Médio)
- Tabela de transações atribuídas a esse closer

Reutiliza o mesmo hook `useTransactionsByBU` e lógica de matching por email/phone já existente.

Arquivo: `src/pages/crm/CloserMeetingsDetailPage.tsx`

### 4. Novo componente: CloserRevenueTab

Componente isolado para a aba de faturamento dentro do detalhe do closer. Recebe closerId, startDate, endDate e busca as transações + attendees para aquele closer.

Arquivo: `src/components/closer/CloserRevenueTab.tsx`

## Seção Técnica

### Lógica de Atribuição (já existente, será reutilizada)

O matching de transação para closer funciona via:
1. Buscar `meeting_slot_attendees` com `status = 'contract_paid'` no período
2. Obter email/phone do contato via `crm_deals -> crm_contacts`
3. Cruzar com `customer_email` e `customer_phone` das transações Hubla

### Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/components/relatorios/CloserRevenueSummaryTable.tsx` | Tabela resumo de faturamento por closer |
| `src/components/closer/CloserRevenueTab.tsx` | Aba de faturamento no detalhe do closer |

### Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/relatorios/SalesReportPanel.tsx` | Importar e renderizar CloserRevenueSummaryTable entre KPIs e tabela |
| `src/pages/crm/CloserMeetingsDetailPage.tsx` | Adicionar aba "Faturamento" com CloserRevenueTab |

### Fluxo de Dados

O CloserRevenueSummaryTable recebe como props:
- `transactions`: transações filtradas do período
- `closers`: lista de closers R1
- `attendees`: attendees com contract_paid para matching
- `globalFirstIds`: Set de IDs para deduplicação do bruto

O CloserRevenueTab internamente:
- Usa `useTransactionsByBU('incorporador', filters)` para buscar transações
- Busca attendees filtrando por `closer_id` do closer em questão
- Filtra transações por email/phone match (mesma lógica do SalesReportPanel)
- Exibe KPIs + tabela paginada
