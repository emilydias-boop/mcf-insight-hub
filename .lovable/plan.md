

## Adicionar paginação na tabela de Cobranças

A tabela atual renderiza todas as assinaturas de uma vez, sem paginação. Com centenas de registros, fica pesado e difícil de navegar.

### Alterações

**`src/components/financeiro/cobranca/CobrancaTable.tsx`**
- Adicionar estado local de `page` (padrão 1) e `pageSize` (padrão 25)
- Fatiar `subscriptions` com `slice(start, end)` para exibir apenas a página atual
- Adicionar rodapé com:
  - Contador: "Mostrando X-Y de Z assinaturas"
  - Seletor de itens por página (25, 50, 100)
  - Botões Anterior / Próxima com estado disabled nas bordas
- Resetar para página 1 quando `subscriptions` mudar (novo filtro aplicado)

Nenhum outro arquivo precisa ser alterado -- a paginação fica totalmente dentro do componente da tabela, client-side.

