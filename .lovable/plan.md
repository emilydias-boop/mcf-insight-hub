

## Plano: Alinhar dados do Dashboard com as páginas de Vendas das BUs

### Problema atual
O Dashboard busca dados de fontes diferentes das páginas de Vendas de cada BU, causando divergência nos valores:
- **MCF Incorporador**: Dashboard usa `get_all_hubla_transactions` (todas as transações) + deduplicação. A página de Vendas BU filtra por produtos com `target_bu = 'incorporador'`.
- **Efeito Alavanca**: Dashboard busca `consortium_cards` com `categoria = 'inside'`. Deveria buscar como a página de Vendas Consórcio: `get_hubla_transactions_by_bu('consorcio')` somando `product_price`.
- **Crédito/Projetos/Leilão**: Dashboard busca dados de tabelas diversas, mas o usuário diz que esses setores ainda não estão configurados.

### Solução

Refatorar `useSetoresDashboard.ts` para usar a mesma RPC `get_hubla_transactions_by_bu` que as páginas de Vendas usam.

### Alterações

**Arquivo: `src/hooks/useSetoresDashboard.ts`**

1. **MCF Incorporador**: Trocar `useIncorporadorGrossMetrics` por 3 chamadas `get_hubla_transactions_by_bu(p_bu='incorporador')` (semana/mês/ano) + aplicar `getDeduplicatedGross` com `get_first_transaction_ids` — mesmo cálculo de bruto da página de Vendas.

2. **Efeito Alavanca**: Trocar queries de `consortium_cards`/`consortium_installments` por 3 chamadas `get_hubla_transactions_by_bu(p_bu='consorcio')` (semana/mês/ano) + somar `product_price` — mesmo cálculo de bruto da página Vendas Consórcio.

3. **MCF Crédito / Projetos / Leilão**: Remover queries atuais, retornar 0 por enquanto (não configurados).

4. **Remover** imports/dependências não mais necessários (`useIncorporadorGrossMetrics`, queries de `consortium_cards`, `consortium_payments`, `consortium_installments`).

5. **Simplificar** o `useMemo` de `modifiedData` (não precisa mais do "diff" do Incorporador).

### Resultado esperado
- O Bruto Total do MCF Incorporador no Dashboard vai bater com o Bruto Total da página Vendas MCF Incorporador.
- O valor do Efeito Alavanca no Dashboard vai bater com o Bruto Total da página Vendas Consórcio.
- Crédito, Projetos e Leilão mostram R$ 0,00 até serem configurados.

