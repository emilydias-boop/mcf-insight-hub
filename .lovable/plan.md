

## Remover completamente "Importar" e "Relatórios" do BU Consórcio

### Escopo

Remover sidebar, rotas e arquivos de página das funcionalidades "Importar" e "Relatórios" do BU Consórcio.

### Alterações

1. **`src/components/layout/AppSidebar.tsx`** (linhas 148-149)
   - Remover os itens "Importar" e "Relatórios" do array de items do menu Consórcio

2. **`src/App.tsx`**
   - Remover imports: `ConsorcioImportar` (linha 88) e `ConsorcioRelatorio` (linha 100)
   - Remover rotas: `/consorcio/importar` (linha 173) e `/consorcio/relatorio` (linha 177)

3. **Deletar arquivos de página**:
   - `src/pages/bu-consorcio/Importar.tsx`
   - `src/pages/bu-consorcio/Relatorio.tsx`

