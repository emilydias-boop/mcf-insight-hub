

## Simplificar coluna Parceria e adicionar coluna separada para Valor Bruto

### Mudanças

**`src/components/relatorios/CarrinhoAnalysisReportPanel.tsx`**:

1. **Coluna "Parceria"** (linha ~531-542): remover os valores B/L que aparecem abaixo do badge. Manter apenas o badge "Sim dd/MM" ou "—".

2. **Nova coluna "Vlr. Parceria"** após "Parceria" (linha ~484): adicionar `<TableHead>` e `<TableCell>` que exibe `l.parceriaBruto` formatado como currency (R$), ou "—" se null.

3. **Excel export** (linhas 118-120): remover "Parceria Líquido", renomear "Parceria Bruto" para "Valor Parceria".

### Arquivo alterado
- `src/components/relatorios/CarrinhoAnalysisReportPanel.tsx`

