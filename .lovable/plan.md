
# Adicionar Patrimonio no menu lateral (sidebar)

## O que sera feito

Adicionar uma nova secao "Patrimonio" no menu lateral do sistema com dois links:

- **Central de Patrimonio** (`/patrimonio`) - para a equipe de TI cadastrar e gerenciar equipamentos (visivel para admin, manager, rh)
- **Meus Equipamentos** (`/patrimonio/meus-equipamentos`) - para qualquer colaborador ver seus equipamentos e aceitar termos (visivel para todos)

## Detalhes tecnicos

### Arquivo a modificar

**`src/components/layout/AppSidebar.tsx`**

1. Adicionar o icone `Monitor` na lista de imports do `lucide-react`
2. Inserir um novo item no array `menuItems`, posicionado na area operacional (apos "Tarefas" ou "RH"), com a seguinte estrutura:

```text
{
  title: "Patrimonio",
  icon: Monitor,
  resource: "patrimonio",
  items: [
    { title: "Central de Patrimonio", url: "/patrimonio", requiredRoles: ["admin", "manager", "rh"] },
    { title: "Meus Equipamentos", url: "/patrimonio/meus-equipamentos" },
  ],
}
```

- "Central de Patrimonio" fica restrito a admin/manager/rh (equipe de TI)
- "Meus Equipamentos" fica visivel para todos os colaboradores (sem requiredRoles)
- O `resource: "patrimonio"` usa o sistema de permissoes existente (ResourceGuard)
