

# Nova aba "Produtos Adquiridos" no Drawer de Negocio

## Resumo

Adicionar uma 6a aba no drawer de detalhes do lead (DealDetailsDrawer) chamada **"Produtos"** onde o usuario pode selecionar quais produtos o lead adquiriu a partir do consorcio (ex: Aporte Holding, Socios, Reverter, Carta para Holding) e informar o valor de cada um. Tambem incluir uma area de configuracao para gerenciar as opcoes de produtos disponiveis (adicionar, editar, excluir).

---

## O que sera criado

### 1. Tabela de opcoes de produtos (configuracao)
**Tabela: `consorcio_produto_adquirido_options`**
- `id` (uuid, PK)
- `name` (text) - nome interno
- `label` (text) - nome de exibicao (ex: "Aporte Holding")
- `display_order` (integer)
- `is_active` (boolean, default true)
- `created_at`, `updated_at`

Seguindo o mesmo padrao da tabela `consorcio_tipo_produto_options`.

### 2. Tabela de produtos adquiridos por deal
**Tabela: `deal_produtos_adquiridos`**
- `id` (uuid, PK)
- `deal_id` (uuid, FK -> crm_deals)
- `produto_option_id` (uuid, FK -> consorcio_produto_adquirido_options)
- `valor` (numeric) - valor do produto adquirido
- `created_at`

### 3. Hooks de dados
**`src/hooks/useDealProdutosAdquiridos.ts`**
- `useProdutoAdquiridoOptions()` - listar opcoes configuradas
- `useCreateProdutoAdquiridoOption()` / `useUpdateProdutoAdquiridoOption()` / `useDeleteProdutoAdquiridoOption()` - CRUD das opcoes
- `useDealProdutosAdquiridos(dealId)` - listar produtos adquiridos por um deal
- `useAddDealProdutoAdquirido()` - adicionar produto a um deal
- `useRemoveDealProdutoAdquirido()` - remover produto de um deal

### 4. Componente da aba "Produtos"
**`src/components/crm/DealProdutosAdquiridosTab.tsx`**
- Lista de produtos ja selecionados com seus valores
- Seletor para adicionar novo produto (dropdown das opcoes) + campo de valor
- Botao de remover para cada produto adquirido
- Botao de configuracao (engrenagem) que abre modal para gerenciar opcoes

### 5. Modal de configuracao de opcoes
**`src/components/crm/ProdutoAdquiridoConfigModal.tsx`**
- Lista de opcoes existentes com campo editavel de label
- Adicionar nova opcao
- Excluir opcao
- Mesmo padrao visual do `ConsorcioConfigModal`

### 6. Alteracao no DealDetailsDrawer
- Adicionar a 6a aba "Produtos" na TabsList (grid passa de 5 para 6 colunas)
- Renderizar `DealProdutosAdquiridosTab` no TabsContent

---

## Detalhes tecnicos

### Migracao SQL
```sql
CREATE TABLE consorcio_produto_adquirido_options (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  label text NOT NULL,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE deal_produtos_adquiridos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id uuid NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  produto_option_id uuid NOT NULL REFERENCES consorcio_produto_adquirido_options(id),
  valor numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(deal_id, produto_option_id)
);

ALTER TABLE consorcio_produto_adquirido_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_produtos_adquiridos ENABLE ROW LEVEL SECURITY;
-- Politicas permissivas para usuarios autenticados
```

### Arquivos modificados
- `src/components/crm/DealDetailsDrawer.tsx` - adicionar aba "Produtos"

### Arquivos criados
- `src/hooks/useDealProdutosAdquiridos.ts`
- `src/components/crm/DealProdutosAdquiridosTab.tsx`
- `src/components/crm/ProdutoAdquiridoConfigModal.tsx`

### UX da aba
- Ao abrir a aba, mostra lista dos produtos ja vinculados ao deal com label + valor formatado em BRL
- Na parte inferior, um select com as opcoes disponiveis + input de valor + botao "Adicionar"
- Cada item tem botao de lixeira para remover
- Icone de engrenagem no canto superior da aba para abrir o modal de configuracao das opcoes
- Total somado dos valores exibido no rodape
