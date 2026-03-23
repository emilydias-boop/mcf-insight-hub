

## Plano: Melhorar Configuração de Produtos

### Mudanças

#### 1. Edição em massa (bulk edit)
- Checkboxes na tabela para selecionar multiplos produtos
- Barra de ações em massa (similar ao `BulkActionsBar` do CRM) com:
  - Definir BU para todos selecionados
  - Definir Categoria para todos selecionados
  - Ativar/Desativar todos selecionados
  - Marcar/desmarcar "Contar no Dashboard"

#### 2. Agrupamento por código de produto
- Produtos com mesmo `product_code` aparecem agrupados visualmente (fundo alternado ou indentação)
- Header do grupo mostra o código e quantas variações existem
- Permite identificar duplicatas rapidamente

#### 3. Criação manual de produto
- Botão "Novo Produto" ao lado do "Sincronizar"
- Abre o mesmo drawer de edição mas com campos vazios e `product_name` editavel

#### 4. Filtro "sem BU" e "sem código"
- Adicionar opções nos filtros: "Sem BU definida" e "Sem código"
- Facilita encontrar produtos que precisam ser configurados

### Arquivos a alterar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/admin/ConfiguracaoProdutos.tsx` | Adicionar checkboxes, barra de ações em massa, agrupamento visual, botão "Novo Produto", filtros extras |
| `src/components/admin/ProductConfigDrawer.tsx` | Suportar modo criação (product=null com `product_name` editavel) |
| `src/hooks/useProductConfigurations.ts` | Adicionar mutation `useCreateProductConfiguration` e `useBulkUpdateProducts` |

### O que NAO muda
- Tabela `product_configurations` no banco permanece igual
- Logica de sync da Hubla permanece igual
- Cache de precos (`useProductPricesCache`) continua funcionando

