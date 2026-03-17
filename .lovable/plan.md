

## Problema: "Meus Equipamentos" não aparece para usuários comuns

### Causa raiz

O grupo **Patrimônio** no sidebar tem `resource: "patrimonio"`, o que significa que o grupo inteiro (incluindo "Meus Equipamentos") é filtrado pela permissão do recurso `patrimonio`. Usuários como SDRs, Closers e outros que não têm permissão para o recurso `patrimonio` não veem nenhum item do grupo — nem mesmo "Meus Equipamentos", que deveria ser acessível a todos.

Linha 472 do `AppSidebar.tsx`:
```typescript
if (item.resource && !canAccessResource(item.resource)) {
  return false;  // Remove o grupo inteiro, incluindo "Meus Equipamentos"
}
```

### Correção

**`src/components/layout/AppSidebar.tsx`** — Mover "Meus Equipamentos" para fora do grupo Patrimônio, colocando-o na seção de itens pessoais (junto com "Meu RH", "Meu Playbook", etc.) para que fique visível a todos os usuários sem depender da permissão de `patrimonio`.

Concretamente:
1. Remover `{ title: "Meus Equipamentos", url: "/patrimonio/meus-equipamentos" }` do grupo Patrimônio (linha 272)
2. Adicionar na lista `personalMenuItems` (itens pessoais do rodapé do sidebar) como: `{ title: "Meus Equipamentos", url: "/patrimonio/meus-equipamentos", icon: Laptop }`

Isso garante que qualquer usuário logado veja "Meus Equipamentos" no menu, enquanto a Central de Patrimônio e Relatórios continuam protegidos por permissão.

