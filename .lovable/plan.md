

## Remoção completa das BUs Crédito, Projetos e Leilão

### Arquivos a deletar (21 + 2 pastas edge functions)

**Páginas BU Crédito (7):** `src/pages/bu-credito/` — Index, Overview, Deals, Socios, Clientes, Vendas, Relatorios

**Páginas BU Projetos (3):** `src/pages/bu-projetos/` — Index, Vendas, Relatorios

**Páginas BU Outros (2):** `src/pages/bu-outros/` — Index, Vendas

**Páginas legado (3):** `src/pages/Credito.tsx`, `src/pages/Projetos.tsx`, `src/pages/Leilao.tsx`

**Hooks/tipos (2):** `src/hooks/useCreditoData.ts`, `src/types/credito.ts`

**Edge Functions (2 pastas):** `supabase/functions/webhook-projetos/`, `supabase/functions/webhook-leilao/`

### Arquivos a editar (4)

**`src/App.tsx`:**
- Linhas 45-47: remover imports Projetos, Credito, Leilao
- Linhas 104-119: remover imports BU Crédito, BU Projetos, BU Outros
- Linhas 230-231: remover rotas `/projetos` e `/credito`
- Linhas 233-305: remover todas as rotas bu-credito, bu-projetos, bu-outros, leilao

**`src/components/layout/AppSidebar.tsx`:**
- Linhas 8-10: remover imports `FolderKanban`, `CreditCard`, `Gavel`
- Linhas 157-199: remover blocos sidebar BU Crédito, BU Projetos, Leilão
- Linhas 360-362: remover `credito`, `projetos`, `leilao` do `BU_CRM_BASE_PATH`
- Linha 368: remover `credito`, `projetos`, `leilao` do array `buPriority`

**`src/pages/Home.tsx`:**
- Linha 6: remover imports `CreditCard`, `Gavel`
- Linhas 23-34: remover entradas `credito` e `leilao` do `BU_CONFIG`
- Linha 93: mudar grid de `lg:grid-cols-4` para `lg:grid-cols-2`
- Linha 94: mudar array de `['incorporador', 'consorcio', 'credito', 'leilao']` para `['incorporador', 'consorcio']`

**`supabase/config.toml`:**
- Linhas 213-217: remover `[functions.webhook-projetos]` e `[functions.webhook-leilao]`

### O que permanece intacto
- Tipo `BusinessUnit` (com credito, projetos, leilao no enum)
- `BUContext`, `useMyBU`, `useActiveBU`, `BUCRMLayout`
- Admin configs (ConfiguracaoBU, UserDetailsDrawer)
- Tabelas do banco (credit_products, etc.)
- BU Consórcio, Incorporador, Marketing — zero impacto

