
# Popup de Detalhamento Individual do Closer ao Clicar na Tabela

## Resumo

Ao clicar no nome de um closer na tabela "Faturamento por Closer" do Relatorio de Vendas, abrir um Dialog modal com visao completa e individual daquele closer, incluindo:

- Contratos vendidos (quantidade e valor)
- Vendas de Parceria (quantidade e valor)
- Reembolsos (quantidade e valor perdido)
- Melhor dia e pior dia do periodo
- Comparativo com o mes anterior (variacao percentual)
- Total de contribuicao para a empresa

## Mudancas

### 1. Novo componente: CloserRevenueDetailDialog

Dialog modal que recebe o closerId, nome, periodo e as transacoes ja filtradas daquele closer. Internamente:

- Agrupa transacoes por `product_category` para separar contratos (`incorporador`, `contrato`), parcerias (`parceria`), e outros
- Identifica reembolsos via `sale_status = 'refunded'` ou `net_value < 0`
- Agrupa por dia (`sale_date`) para identificar melhor e pior dia (por faturamento bruto)
- Busca transacoes do mes anterior para calcular variacao percentual

Layout do dialog:
- Header com nome do closer e periodo
- Grid de KPI cards (Contratos, Parcerias, Reembolsos, Contribuicao Total)
- Linha de comparativo com mes anterior (setas verde/vermelha)
- Cards de Melhor Dia e Pior Dia
- Mini tabela com breakdown por categoria de produto

Arquivo: `src/components/relatorios/CloserRevenueDetailDialog.tsx`

### 2. Alterar CloserRevenueSummaryTable

Tornar o nome do closer clicavel (cursor pointer, underline on hover). Ao clicar, abrir o `CloserRevenueDetailDialog` passando:
- `closerName`, `closerId`
- `transactions` ja filtradas daquele closer
- `globalFirstIds` para deduplicacao
- `startDate` e `endDate` do periodo

Arquivo: `src/components/relatorios/CloserRevenueSummaryTable.tsx`

### 3. Alterar SalesReportPanel

Passar `dateRange` (startDate/endDate) como props para o `CloserRevenueSummaryTable`, necessario para o dialog buscar dados do mes anterior.

Arquivo: `src/components/relatorios/SalesReportPanel.tsx`

## Secao Tecnica

### Arquivo a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/components/relatorios/CloserRevenueDetailDialog.tsx` | Dialog modal com detalhamento individual |

### Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/relatorios/CloserRevenueSummaryTable.tsx` | Nome clicavel + state para dialog + renderizar CloserRevenueDetailDialog |
| `src/components/relatorios/SalesReportPanel.tsx` | Passar startDate/endDate para CloserRevenueSummaryTable |

### Logica de Calculo no Dialog

```text
Contratos = transacoes com product_category IN ('incorporador', 'contrato', 'contrato-anticrise')
Parcerias = transacoes com product_category = 'parceria'
Reembolsos = transacoes com sale_status = 'refunded' ou net_value < 0
Melhor Dia = dia com maior soma de bruto deduplicated
Pior Dia = dia com menor soma de bruto deduplicated (excluindo dias com 0)
```

### Comparativo Mes Anterior

O dialog usara `useAllHublaTransactions` com filtros do mes anterior (startDate - 1 month) e fara o mesmo matching por email/phone com os attendees do closer para calcular:
- Variacao % do bruto: `((brutoAtual - brutoAnterior) / brutoAnterior) * 100`
- Variacao % de transacoes: `((countAtual - countAnterior) / countAnterior) * 100`

### Props do CloserRevenueSummaryTable (atualizado)

```text
interface CloserRevenueSummaryTableProps {
  transactions: Transaction[];
  closers: Closer[];
  attendees: AttendeeMatch[];
  globalFirstIds: Set<string>;
  isLoading?: boolean;
  startDate?: Date;   // NOVO
  endDate?: Date;     // NOVO
}
```
