

## Adicionar Bruto e Líquido da Parceria ao relatório de Análise de Carrinho

### O que muda

Atualmente a coluna "Parceria" mostra apenas "Sim dd/MM" ou "—". O usuário quer ver também o valor bruto e líquido da parceria de cada lead.

### Correção

**`src/hooks/useCarrinhoAnalysisReport.ts`**:

1. **Expandir select da query de parcerias** (linha 420): adicionar `product_price, net_value`
2. **Expandir parceriaMap** para armazenar `grossValue` e `netValue` junto com `date` e `product`
3. **Adicionar campos na interface `CarrinhoAnalysisLead`** (após linha 111):
   - `parceriaBruto: number | null`
   - `parceriaLiquido: number | null`
4. **Preencher os novos campos** na construção do lead (linha ~863):
   - `parceriaBruto: parceria?.grossValue || null`
   - `parceriaLiquido: parceria?.netValue || null`

**`src/components/relatorios/CarrinhoAnalysisReportPanel.tsx`**:

1. **Substituir coluna "Parceria"** por exibição com valores: mostrar "Sim dd/MM" + bruto/líquido abaixo em fonte menor
2. **Atualizar export Excel** para incluir colunas "Parceria Bruto" e "Parceria Líquido"

### Arquivos alterados
- `src/hooks/useCarrinhoAnalysisReport.ts`
- `src/components/relatorios/CarrinhoAnalysisReportPanel.tsx`

