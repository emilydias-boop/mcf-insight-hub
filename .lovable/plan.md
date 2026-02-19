

# Corrigir Relatorios do Consorcio: Adicionar abas e filtrar dados por BU

## Problema

1. A pagina de Relatorios do Consorcio so tem 2 abas (Vendas, Desempenho) quando deveria ter as 4 abas como o Incorporador (Contratos, Vendas, Desempenho, Aquisicao e Origem).
2. Os paineis de Vendas, Contratos e Aquisicao usam o hook `useAllHublaTransactions` que busca TODAS as transacoes globais (Incorporador, Consorcio, Leilao, etc.), sem filtrar pela BU ativa. Isso faz os dados do Incorporador aparecerem no relatorio do Consorcio.

## Solucao

### 1. Adicionar as 4 abas ao Consorcio

**Arquivo:** `src/pages/bu-consorcio/Relatorio.tsx`

Alterar `availableReports` de `['sales', 'performance']` para `['contracts', 'sales', 'performance', 'acquisition']`.

### 2. Filtrar transacoes por BU no SalesReportPanel

**Arquivo:** `src/components/relatorios/SalesReportPanel.tsx`

O painel atualmente usa `useAllHublaTransactions(filters)` que retorna transacoes de TODAS as BUs. A solucao e substituir pela chamada `useTransactionsByBU(bu, filters)` quando uma BU e informada, usando o RPC `get_hubla_transactions_by_bu` que ja existe no banco e filtra por BU.

Mudancas:
- Importar `useTransactionsByBU`
- Quando `bu` nao for `incorporador`, usar `useTransactionsByBU(bu, filters)` em vez de `useAllHublaTransactions`
- Para `incorporador`, manter `useAllHublaTransactions` (que ja funciona corretamente com deduplicacao)

### 3. Filtrar transacoes por BU no ContractReportPanel

**Arquivo:** `src/components/relatorios/ContractReportPanel.tsx`

Mesma logica: quando a BU for `consorcio`, usar transacoes filtradas por BU em vez do hook global.

### 4. Filtrar transacoes por BU no AcquisitionReportPanel

**Arquivo:** `src/hooks/useAcquisitionReport.ts`

O hook `useAcquisitionReport` ja recebe o parametro `bu` e ja filtra closers e SDRs por BU. Porem, as transacoes vem de `useAllHublaTransactions` (global). Precisa substituir por `useTransactionsByBU` quando a BU nao for `incorporador`.

### 5. Filtrar closers e attendees por BU no PerformanceReportPanel

**Arquivo:** `src/components/relatorios/PerformanceReportPanel.tsx`

O hook `useGestorClosers` ja filtra por `activeBU` via contexto, entao os closers ja devem estar corretos quando acessado pela rota `/bu-consorcio/relatorios`. Verificar se o filtro esta funcionando.

## Detalhes tecnicos

### Logica condicional de fonte de dados

```typescript
// Em SalesReportPanel e outros:
const shouldUseBUFilter = bu && bu !== 'incorporador';

const { data: allTransactions = [], isLoading: loadingAll } = 
  useAllHublaTransactions(shouldUseBUFilter ? { ...filters, search: '__SKIP__' } : filters);

const { data: buTransactions = [], isLoading: loadingBU } = 
  useTransactionsByBU(bu || '', filters);

const transactions = shouldUseBUFilter ? buTransactions : allTransactions;
const isLoading = shouldUseBUFilter ? loadingBU : loadingAll;
```

Nota: Para `incorporador`, mantemos `useAllHublaTransactions` pois a logica de deduplicacao com `getDeduplicatedGross` e `get_first_transaction_ids` e especifica desse hook. Para outras BUs (consorcio, leilao, credito), usamos `useTransactionsByBU` que ja filtra pela categoria/BU no banco.

### Ajuste de metricas brutas para BUs nao-incorporador

Para BUs como consorcio, a logica de "Faturamento Bruto" com `getDeduplicatedGross` (que usa preco de referencia e deduplicacao por primeiro pagamento) nao se aplica. O bruto deve ser simplesmente `product_price` ou `net_value` das transacoes. Isso sera ajustado no calculo de stats dos paineis.

