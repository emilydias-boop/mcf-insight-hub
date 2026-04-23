

## Separar Faturamento Bruto e Líquido no Funil por Canal

### Como cada um é calculado hoje (confirmação)

A coluna "Faturamento" da tabela vem do `useAcquisitionReport.classified` — exatamente as mesmas transações Hubla pagas que alimentam o card "Faturamento Líquido R$ 641.549,44" no topo do painel. O hook já calcula **dois valores** por transação (em `useAcquisitionReport.ts` linhas 377-378):

- **Bruto (`gross`):**
  - Para BU Incorporador (que tem filtro BU ativo): `tx.product_price ?? tx.net_value ?? 0` — usa o `product_price` (preço de tabela do produto, ex: 50.000 para Incorporador 50K).
  - Para outras BUs: usa `getDeduplicatedGross(tx, isFirst)` — pega `reference_price` do catálogo de produtos centralizado, mas só na **primeira transação do contrato** (parcelas seguintes contam 0 para não inflar o bruto).
- **Líquido (`net`):** sempre `tx.net_value` — o que efetivamente caiu no caixa após taxas Hubla, parcelamento, etc. (é igual à coluna `net_value` da `hubla_transactions`).

Hoje o funil mostra **só o líquido** porque a agregação em `useChannelFunnelReport.ts` linha 316 faz `slot.faturamento += net || 0`. O `gross` está sendo descartado.

> Por isso o total da coluna "Faturamento" (R$ 641.549,44) bate exatamente com o card "Receita Líquida" e está bem abaixo do "Faturamento Bruto R$ 918.334,00" — são valores diferentes da mesma venda.

### O que vou alterar

**Arquivo 1: `src/hooks/useChannelFunnelReport.ts`**
- Trocar o campo único `faturamento: number` por dois: `faturamentoBruto: number` e `faturamentoLiquido: number`.
- Na agregação (linha 312-317), somar `gross` e `net` em campos separados:
  ```ts
  slot.faturamentoBruto += gross || 0;
  slot.faturamentoLiquido += net || 0;
  ```
- Ordenar `finalRows` por `faturamentoLiquido` (mantém comportamento atual).
- Atualizar `totals` para incluir os dois.

**Arquivo 2: `src/components/relatorios/ChannelFunnelTable.tsx`**
- Substituir a coluna "Faturamento" por **duas colunas**: "Fat. Bruto" e "Fat. Líquido", lado a lado no fim da tabela.
- Atualizar o `<TableHeader>`, as linhas, e a linha de Total para mostrar ambos com `formatCurrency`.
- Atualizar a interface `Props.totals` para refletir os dois campos.

**Arquivo 3: `src/components/relatorios/AcquisitionReportPanel.tsx`**
- No export Excel da aba "Funil por Canal", desdobrar a coluna em duas (`Fat. Bruto` e `Fat. Líquido`).

### Validação esperada (preset Mês, BU Incorporador)

- Total **Fat. Bruto** do funil ≈ R$ 918.334,00 (bate com o card "Faturamento Bruto" no topo).
- Total **Fat. Líquido** do funil = R$ 641.549,44 (bate com o card "Receita Líquida" e com o valor atual da coluna única).
- Diferença bruto vs líquido por canal explica taxas Hubla / parcelamento — útil para análise de margem por canal.

### O que NÃO vai mudar

- Lógica de classificação de canal (continua usando `detectChannel` da `useAcquisitionReport`).
- Cálculo de `gross` em si — só passo a expô-lo. A regra de deduplicação por contrato (`getDeduplicatedGross`) e o uso de `product_price` no Incorporador continuam idênticos.
- Outras tabelas do painel (Faturamento por Closer, por SDR, por Canal de cima) — não estão no escopo. Posso fazer numa próxima iteração se você pedir.

### Reversibilidade

3 arquivos, ~20 linhas alteradas. Reverter = restaurar nome único `faturamento`.

