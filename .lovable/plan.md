

## Adicionar visão "Por Cliente" no Relatório de Vendas do Incorporador

### Objetivo
Adicionar uma visão agregada por cliente no `SalesReportPanel`, similar ao que foi feito no Cross-BU do Consórcio — agrupando transações por cliente com colunas separadas para A010, Contrato, Parceria e Outros.

### Mudanças

**Arquivo: `src/components/relatorios/SalesReportPanel.tsx`**

1. **Novo estado `viewMode`**: toggle entre `'transactions'` (atual) e `'by_client'` (agrupado)
   - Dois botões/tabs acima da tabela: "Transações" | "Por Cliente"

2. **Lógica de agrupamento** (novo `useMemo`):
   - Agrupa `filteredTransactions` por `UPPER(TRIM(customer_email))` (email é mais confiável no Incorporador, diferente do Consórcio)
   - Para cada cliente agrega:
     - `nome`, `email`, `telefone`
     - `totalTx` (quantidade)
     - `brutoA010` (soma bruto onde `product_category = 'a010'`)
     - `brutoContrato` (soma bruto onde `product_category = 'contrato'`)
     - `brutoParceria` (soma bruto onde `product_category = 'parceria'`)
     - `brutoOutros` (soma bruto das demais categorias)
     - `brutoTotal`, `liquidoTotal`
     - `primeiraCompra`, `ultimaCompra` (datas min/max)
     - `closerR1`, `closerR2`, `sdr` (do enrichment, pega o primeiro não-vazio)
     - `stageAtual` (do enrichment)
   - Usa `getDeduplicatedGross()` para calcular bruto (mantendo consistência com a lógica existente)
   - Ordena por `brutoTotal` desc

3. **Nova tabela "Por Cliente"** (renderizada quando `viewMode === 'by_client'`):

| Cliente | Email | SDR | Closer R1 | Closer R2 | Qtd Tx | Bruto A010 | Bruto Contrato | Bruto Parceria | Bruto Outros | Bruto Total | Líquido Total | 1ª Compra | Última Compra | Stage |

4. **Paginação**: reutiliza os mesmos controles existentes, aplicados sobre o array agrupado

5. **Export Excel**: quando `viewMode === 'by_client'`, exporta o formato agrupado

6. **KPIs e CloserRevenueSummaryTable**: permanecem iguais (baseados em `filteredTransactions`, não mudam com o viewMode)

### Escopo
- Apenas `src/components/relatorios/SalesReportPanel.tsx` é alterado
- A tabela "Transações no Período" atual continua existindo — é apenas um toggle de visualização

