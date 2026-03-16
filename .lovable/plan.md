

## Problema: Paginação esconde parcelas de outros dias

O banco de dados mostra que em março há 177 parcelas distribuídas assim:
- **10/03**: 67 parcelas
- **16/03**: 24 parcelas
- **19/03**: 1 parcela
- **20/03**: 83 parcelas
- **26/03**: 2 parcelas

A tabela exibe **50 por página** e ordena por `data_vencimento ASC`. Como só o dia 10 já tem 67 parcelas, a primeira página mostra apenas parcelas do dia 10. Os dias 16, 19, 20 e 26 ficam nas páginas seguintes.

### Solução

1. **Aumentar o pageSize para 100** -- reduz o problema mas não elimina
2. **Melhor abordagem: Agrupar por data de vencimento** -- adicionar um agrupamento visual na tabela mostrando headers por data, ou simplesmente **aumentar o pageSize padrão para 200** para que todas as ~177 parcelas do mês caibam em 1-2 páginas
3. **Adicionar seletor de itens por página** (50, 100, 200, Todos) na tabela para o usuário controlar

### Alterações

**`src/components/consorcio/pagamentos/ConsorcioPagamentosTab.tsx`**
- Mudar pageSize padrão de 50 para 200
- Adicionar seletor de itens por página (50, 100, 200, Todos)

**`src/components/consorcio/pagamentos/PagamentosTable.tsx`**
- Adicionar dropdown de "itens por página" ao lado da paginação
- Opções: 50, 100, 200, "Todos"

Isso garante que o mês inteiro fique visível de imediato sem precisar paginar, já que o volume mensal é de ~150-200 parcelas.

