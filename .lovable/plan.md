

# Filtrar produtos de outras BUs no relatório do Incorporador

## Problema

Quando `bu === 'incorporador'`, o `SalesReportPanel` usa `useAllHublaTransactions` que retorna TODAS as transações de todas as BUs. O `CloserRevenueSummaryTable` apenas isola as categorias `a010`, `renovacao` e `ob_vitalicio`, mas não exclui categorias que pertencem a outras BUs como:

- `clube_arremate` (pertence a Consórcio/Leilão)
- `projetos` (BU Projetos)
- `ob_construir_alugar` (pertence a Consórcio)
- `imersao` (pertence a Consórcio)
- `ob_construir` (verificar — está mapeado como incorporador em 1 produto, mas o usuário quer excluir)

Essas transações entram no fluxo de atribuição e inflam os números de "Sem Closer" e possivelmente de closers individuais.

## Solução

Adicionar um filtro de categorias excluídas no `CloserRevenueSummaryTable`, removendo transações cujo `product_category` pertence a outras BUs antes de processar a atribuição.

## Detalhes técnicos

### Arquivo: `src/components/relatorios/CloserRevenueSummaryTable.tsx`

Adicionar uma lista de categorias excluídas do Incorporador e filtrar as transações antes do loop de atribuição:

```typescript
// Categorias que pertencem a outras BUs e não devem aparecer no Incorporador
const EXCLUDED_FROM_INCORPORADOR = new Set([
  'clube_arremate',
  'projetos',
  'ob_construir_alugar',
  'imersao',
  'ob_construir',
  'imersao_socios',
  'efeito_alavanca',
  'consorcio',
  'credito',
  'formacao',
  'socios',
]);
```

No `useMemo` principal que processa as transações (por volta da linha 120), adicionar um filtro antes do loop:

```typescript
// Filtrar transações que não pertencem à BU Incorporador
const filteredTxs = transactions.filter(tx => 
  !EXCLUDED_FROM_INCORPORADOR.has(tx.product_category || '')
);
```

E usar `filteredTxs` no loop de atribuição em vez de `transactions`.

### Arquivo: `src/components/relatorios/SalesReportPanel.tsx`

Opcionalmente, aplicar o mesmo filtro no nível do painel para que a contagem total do relatório de Vendas também seja consistente (KPIs, tabelas de transações, etc.).

### Resultado esperado

- Transações de `clube_arremate`, `projetos`, `ob_construir_alugar`, `imersao` e `ob_construir` deixam de aparecer nos números de closers e "Sem Closer"
- Os totais de faturamento e quantidade de transações refletem apenas produtos da BU Incorporador
- A consistência entre Vendas e Aquisição é mantida

