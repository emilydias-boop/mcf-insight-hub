
# Plano: Remover Painel de Premiações

## Visão Geral

Remover completamente a funcionalidade de "Premiações" do sistema, incluindo o link no menu lateral e as rotas associadas.

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/layout/AppSidebar.tsx` | Remover item de navegação "Premiações" |
| `src/App.tsx` | Remover imports e rotas de Premiações |

## Mudanças Detalhadas

### 1. AppSidebar.tsx (Linhas 246-251)
Remover o item de menu:
```typescript
// REMOVER este bloco:
// PREMIAÇÕES - Visível para todas as roles
{
  title: "Premiações",
  url: "/premiacoes",
  icon: Trophy,
},
```

### 2. App.tsx

**Imports (Linhas 123-126)** - Remover:
```typescript
// REMOVER:
import PremiacoesIndex from "./pages/premiacoes/Index";
import PremiacaoDetail from "./pages/premiacoes/Detail";
import NovaPremiacao from "./pages/premiacoes/NovaPremiacao";
```

**Rotas (Linhas 213-216)** - Remover:
```typescript
// REMOVER:
{/* Premiações Routes */}
<Route path="premiacoes" element={<PremiacoesIndex />} />
<Route path="premiacoes/nova" element={...} />
<Route path="premiacoes/:id" element={<PremiacaoDetail />} />
```

## Resultado

- O link "Premiações" desaparecerá do menu lateral
- As rotas `/premiacoes`, `/premiacoes/nova` e `/premiacoes/:id` não estarão mais acessíveis

## Observação

Os arquivos da pasta `src/pages/premiacoes/` e `src/components/premiacoes/` **não serão deletados**, apenas ficarão inativos. Caso queira reativar no futuro, basta reverter estas mudanças.
