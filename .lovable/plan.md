
# Correção: Visibilidade do Menu Premiações

## Diagnóstico

O item "Premiações" foi adicionado corretamente ao sidebar (linha 246-251) com as seguintes configurações:

```typescript
{
  title: "Premiações",
  url: "/premiacoes",
  icon: Trophy,
  requiredRoles: ["admin", "manager", "coordenador", "sdr", "closer", "closer_sombra"],
}
```

### Por que não está aparecendo?

**Possibilidade 1**: Sua role atual não está na lista
- Roles que **NÃO** veem Premiações: `viewer`, `financeiro`, `rh`
- Se você está logado como uma dessas roles, não verá o menu

**Possibilidade 2**: Posição no menu dificulta encontrar
- O item está no meio da lista, entre "Tarefas" e "Minhas Reuniões"
- Pode parecer "perdido" para usuários que não scrollam

---

## Correções Propostas

### 1. Adicionar todas as roles que deveriam ver Premiações

Incluir `rh` e `financeiro` na lista de roles, pois eles também podem participar de premiações:

```typescript
requiredRoles: ["admin", "manager", "coordenador", "sdr", "closer", "closer_sombra", "rh", "financeiro", "viewer"],
```

### 2. Reposicionar o item no menu

Mover para uma posição mais visível - próximo ao final, antes de Configurações, para que seja facilmente encontrado por todos os usuários.

### 3. Confirmar que não há filtro de BU

O item **não** possui `requiredBU`, então está correto - todas as BUs podem ver.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/layout/AppSidebar.tsx` | Adicionar mais roles ao item Premiações e reposicionar no menu |

---

## Verificação

Após a correção:
1. Logar com diferentes roles (SDR, Closer, Manager, RH)
2. Verificar se o menu "Premiações" aparece para todas
3. Clicar e confirmar acesso à página `/premiacoes`
