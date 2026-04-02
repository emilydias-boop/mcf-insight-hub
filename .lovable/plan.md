

## Remover seção "Relatórios" do sidebar

### O que muda

Remover o bloco de navegação "Relatórios" (com "Visão Geral" e "Leads sem Tag") do sidebar principal, já que cada BU possui seus próprios relatórios internos.

### Alteração

**`src/components/layout/AppSidebar.tsx`** (linhas 185-194) — Remover o bloco inteiro do menu "Relatórios":

```tsx
// REMOVER este bloco:
{
  title: "Relatórios",
  icon: FileText,
  requiredRoles: ["admin", "manager", "coordenador"],
  items: [
    { title: "Visão Geral", url: "/relatorios" },
    { title: "Leads sem Tag", url: "/relatorios/leads-sem-tag" },
  ],
},
```

As rotas e componentes (`/relatorios`, `/relatorios/leads-sem-tag`) continuam existindo no código mas ficam inacessíveis pelo menu. Se desejar, posso removê-los também em um próximo passo.

