

## Separar Cobranças em página própria `/cobrancas`

A aba "Cobranças" será removida da página `/financeiro` e se tornará uma página standalone em `/cobrancas`, acessível via sidebar no menu Financeiro.

### Alterações

**1. Nova página `src/pages/Cobrancas.tsx`**
- Página dedicada com título "Cobranças" e subtítulo
- Reutiliza o componente `FinanceiroCobrancas` existente (KPIs, filtros, tabela, drawer)
- Guard de acesso: roles `admin` e `financeiro`
- Futuramente poderá ter seções/abas próprias (ex: Assinaturas, Acordos, Histórico Geral)

**2. Rota em `src/App.tsx`**
- Adicionar `<Route path="cobrancas" ...>` com ResourceGuard ou RoleGuard para `admin`/`financeiro`

**3. Sidebar em `src/components/layout/AppSidebar.tsx`**
- Adicionar item "Cobranças" no grupo Financeiro: `{ title: "Cobranças", url: "/cobrancas", requiredRoles: ["admin", "financeiro"] }`

**4. Remover aba "Cobranças" de `src/pages/Financeiro.tsx`**
- Remover o `TabsTrigger` e `TabsContent` de cobranças
- Remover import do `FinanceiroCobrancas`

Todos os componentes em `src/components/financeiro/cobranca/` e hooks permanecem inalterados -- apenas a "casca" muda de aba para página.

