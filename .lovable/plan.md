

## Nova aba "Cross-BU" no Relatório do Consórcio

Criar uma nova aba de relatório no estilo lista/tabela flat (igual ao "Transações no Período" do Incorporador mostrado na screenshot), que cruza leads do Consórcio com compras em todas as BUs.

### Mudanças

#### 1. `src/components/relatorios/ReportTypeSelector.tsx`
- Adicionar `'cross_bu'` ao union type `ReportType`
- Nova opção: ícone `History`, título "Cross-BU", descrição "Compras do lead em todas as BUs"

#### 2. Novo `src/components/relatorios/CrossBUReportPanel.tsx`

**Dados:**
1. Query 1: Buscar todos os `consortium_cards` (campos: `id`, `nome_completo`, `email`, `telefone`, `grupo`, `cota`, `origem`)
2. Query 2: Com os emails encontrados, buscar `hubla_transactions` via `.in('customer_email', emails)` — sem filtro de BU, trazendo todo o histórico cross-BU
3. Join client-side: para cada transação, anexar dados de contato do lead do consórcio

**Filtros** (mesma row de filtros do SalesReportPanel):
- Busca por nome/email/telefone
- Período (DateRange com presets Hoje/Semana/Mês/Custom)
- Filtro por produto (Select dinâmico)
- Filtro por status (completed, refunded, etc.)
- Botão Limpar + Exportar Excel

**KPI Cards** (4 cards como no SalesReportPanel):
- Total de Leads (emails únicos)
- Total de Transações
- Faturamento Bruto
- Ticket Médio

**Tabela flat** (igual ao screenshot):
| Data | Cliente | Email | Telefone | Grupo/Cota | Produto | Bruto | Líquido | Parcela | Fonte | Status |

**Paginação** idêntica ao SalesReportPanel (25/50/100 por página)

#### 3. `src/components/relatorios/BUReportCenter.tsx`
- Importar `CrossBUReportPanel`
- Adicionar case `selectedReport === 'cross_bu'` renderizando `<CrossBUReportPanel bu={bu} />`

#### 4. `src/pages/bu-consorcio/Relatorio.tsx`
- Adicionar `'cross_bu'` ao array `availableReports`

