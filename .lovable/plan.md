

# Plano: Criar Aba TAREFAS no Menu Lateral

## Posição no Sidebar

A nova aba será inserida **após RH** (linha 224) e **antes de Configurações** (linha 269) no arquivo `AppSidebar.tsx`.

```
RH                    ← Já existe
  └─ Colaboradores
                      
TAREFAS              ← NOVA ABA (será adicionada aqui)
                      
Configurações         ← Já existe
```

## Arquivos a Criar/Modificar

### 1. Nova Página: `src/pages/Tarefas.tsx`

Página inicial simples com estrutura pronta para receber conteúdo futuro:

```typescript
import { CheckSquare } from "lucide-react";

const Tarefas = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CheckSquare className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Tarefas</h1>
          <p className="text-muted-foreground">
            Gerencie suas tarefas e atividades
          </p>
        </div>
      </div>
      
      {/* Conteúdo futuro será adicionado aqui */}
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        Em construção - Adicione funcionalidades aqui
      </div>
    </div>
  );
};

export default Tarefas;
```

### 2. Modificar: `src/components/layout/AppSidebar.tsx`

Adicionar item de navegação entre RH e Configurações (após linha 224):

```typescript
// TAREFAS
{
  title: "Tarefas",
  url: "/tarefas",
  icon: CheckSquare,
  requiredRoles: ["admin", "manager", "coordenador"],
},
```

- Importar o ícone `CheckSquare` do lucide-react

### 3. Modificar: `src/App.tsx`

Adicionar rota para a página de Tarefas (próximo às outras rotas principais):

```typescript
import Tarefas from "./pages/Tarefas";

// Na seção de rotas:
<Route 
  path="tarefas" 
  element={
    <RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}>
      <Tarefas />
    </RoleGuard>
  } 
/>
```

## Resumo das Mudanças

| Arquivo | Ação |
|---------|------|
| `src/pages/Tarefas.tsx` | **Criar** - Página inicial de Tarefas |
| `src/components/layout/AppSidebar.tsx` | **Modificar** - Adicionar item no menu (linha ~225) |
| `src/App.tsx` | **Modificar** - Adicionar rota `/tarefas` |

## Permissões

- Acesso: `admin`, `manager`, `coordenador`
- Pode ser ajustado posteriormente conforme necessidade

## Próximos Passos (após aprovação)

Depois de criar a aba, você poderá adicionar:
- Listagem de tarefas
- Filtros
- KPIs
- Integração com `deal_tasks`
- Ou qualquer outra funcionalidade que desejar

