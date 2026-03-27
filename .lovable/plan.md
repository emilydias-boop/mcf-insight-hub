

## Adicionar "Leads que Avancaram" ao Relatorio de Analise de Carrinho

### Problema
O relatorio so mostra leads perdidos na tabela detalhada. O usuario precisa ver tambem os leads que avancaram (comunicados, R2 agendada, R2 realizada) para comparar ganhos vs perdas e identificar melhorias.

### Solucao

**1. Hook `useCarrinhoAnalysisReport.ts`**
- Criar novo array `leadsAvancados: LeadAvancado[]` com os leads que tiveram R2 realizada (ou ao menos R2 agendada)
- Interface `LeadAvancado`: nome, telefone, estado, dataCompra, produto, statusAtual, r2Agendada, r2Realizada, closerName, dataR2, isOutside
- No loop de processamento (linha 381), quando `isR2Realizada` ou `isR2Agendada`, adicionar ao array `leadsAvancados` em vez de so pular
- Retornar `leadsAvancados` no objeto de resposta

**2. Painel `CarrinhoAnalysisReportPanel.tsx`**
- Adicionar tabs "Perdidos" e "Avancaram" na secao de tabela detalhada (usando o componente `Tabs` existente)
- Tab "Avancaram": tabela com colunas Nome, Telefone, UF, Data Compra, Status, Closer, Data R2, Outside
- Tab "Perdidos": tabela atual (sem mudanca)
- Filtros proprios para cada tab (motivo so aparece nos perdidos, closer aparece nos avancados)
- Contador em cada tab badge: "Avancaram (44)" / "Perdidos (14)"
- Exportar Excel tambem funciona para a tab ativa

**3. Comparativo visual**
- Acima das tabs, adicionar um mini resumo lado a lado:
  - Card verde: "Avancaram" com count e % do total
  - Card vermelho: "Perdidos" com count e % do total
  - Card amarelo: "Gap Operacional" = perdidos com tipo "operacional" (os que poderiam ter sido salvos)

### Detalhes tecnicos
- `LeadAvancado` sera uma interface separada (campos diferentes de `LeadDetalhado`)
- `CarrinhoAnalysisData` ganha campo `leadsAvancados: LeadAvancado[]`
- Tab state com `useState<'avancados' | 'perdidos'>('avancados')`
- Export Excel adapta colunas conforme tab ativa

