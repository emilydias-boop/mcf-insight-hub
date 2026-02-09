
# Corrigir Relatório de Vendas para Usar a Mesma Fonte de Dados da Página de Vendas

## Problema

A aba "Vendas" em Relatórios (/bu-incorporador/relatorios) mostra dados diferentes da página de Vendas (/bu-incorporador/vendas):

- **Vendas**: 2.196 transações, R$ 2.016.398 bruto (usa `get_all_hubla_transactions`)
- **Relatórios**: 2.713 transações, R$ 1.799.871 bruto (usa `get_hubla_transactions_by_bu`)

Duas causas raiz:

1. **RPCs diferentes**: A página de Vendas usa `useAllHublaTransactions` (RPC `get_all_hubla_transactions`), enquanto o Relatório usa `useTransactionsByBU` (RPC `get_hubla_transactions_by_bu`). Essas RPCs retornam conjuntos de dados diferentes.

2. **Formatação de datas diferente**: A página de Vendas formata datas com timezone de Brasilia (UTC-3: `2026-01-01T00:00:00-03:00`), enquanto o Relatório passa datas em UTC (`.toISOString()`), causando discrepancia de 3 horas nos limites do periodo.

## Solucao

Trocar o hook `useTransactionsByBU` por `useAllHublaTransactions` no `SalesReportPanel.tsx`, garantindo paridade exata com a pagina de Vendas.

## Secao Tecnica

### Arquivo a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/relatorios/SalesReportPanel.tsx` | Substituir `useTransactionsByBU` por `useAllHublaTransactions` |

### Mudancas Especificas

1. **Trocar import**: Remover `useTransactionsByBU`, importar `useAllHublaTransactions` e `TransactionFilters` de `@/hooks/useAllHublaTransactions`

2. **Ajustar construcao dos filtros**: Passar `selectedProducts` nos filtros (compativel com a interface `TransactionFilters` do hook)

3. **Trocar chamada do hook**:
```text
// Antes:
const { data: transactions = [], isLoading } = useTransactionsByBU(bu, filters);

// Depois:
const { data: transactions = [], isLoading } = useAllHublaTransactions(filters);
```

### Resultado Esperado

Os numeros de transacoes, faturamento bruto e receita liquida no Relatorio de Vendas serao identicos aos da pagina de Vendas para o mesmo periodo, pois ambos usarao a mesma RPC e o mesmo tratamento de timezone.
