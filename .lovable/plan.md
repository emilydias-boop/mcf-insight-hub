

## Plano: Simplificar Visão Geral e mover Tags para Configurações

### 1. `src/pages/crm/Overview.tsx` — Simplificar
- Remover sistema de Tabs inteiro (imports de Tabs, TabsTrigger, etc.)
- Remover import de `Tags`, `Tag` icon, `useState`
- Renderizar apenas o `<FunilDashboard />` diretamente, sem abas

### 2. `src/pages/crm/Configuracoes.tsx` — Adicionar aba Tags
- Importar `Tags` de `./Tags` e ícone `Tag` de lucide-react
- Adicionar novo `TabsTrigger` com `value="tags"` na TabsList
- Adicionar novo `TabsContent` com `value="tags"` renderizando `<Tags />`

