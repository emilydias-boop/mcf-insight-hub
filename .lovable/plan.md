
# Plano: Preservar Navegação ao Restaurar Sessão

## Problema Identificado

Quando o usuário sai da página e volta, acontece o seguinte fluxo problemático:

```text
1. Usuário está em /crm/reunioes-equipe
2. Sai da aba/página  
3. Volta para a página
4. AuthContext reinicia (user = null, loading = true)
5. Supabase dispara SIGNED_IN ao restaurar sessão do localStorage
6. Durante loading, ProtectedRoute mostra spinner
7. Quando loading termina, rota "/" é avaliada
8. Navigate to="/home" é acionado → Usuário vai para /home
```

## Causa Raiz

A rota index em `App.tsx` (linha 162) força redirecionamento:
```tsx
<Route index element={<Navigate to="/home" replace />} />
```

Quando o AuthContext reinicia, a URL pode ser momentaneamente interpretada como `/` antes da navegação ser restaurada.

## Solução

Modificar o `AuthContext` para **não interferir na navegação** quando a sessão é restaurada. O usuário deve permanecer na URL atual.

### Mudanças Necessárias

**1. Remover navegação automática do `handleSession`**

O `handleSession` não deve fazer nenhum redirecionamento - apenas atualizar o estado de autenticação.

**2. Manter navegação apenas no `signIn` explícito**

A navegação para `/home` ou `/sdr/minhas-reunioes` deve acontecer **somente** quando o usuário faz login manualmente via formulário.

**3. Verificar o comportamento do `ProtectedRoute`**

Garantir que o `ProtectedRoute` não force redirecionamento desnecessário durante a restauração da sessão.

### Código a Modificar

**`src/contexts/AuthContext.tsx`**

Na função `onAuthStateChange`, quando o evento for `SIGNED_IN` mas o usuário já estava logado (sessão restaurada do localStorage), não fazer nada de navegação:

```typescript
// Atual - problema: user é null quando volta para página
if ((event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') && 
    user && 
    newSession?.user?.id === user.id) {
  // ...
  return;
}

// Novo - usar ref para rastrear se é sessão restaurada
if (event === 'SIGNED_IN' && initialSessionHandled.current) {
  // Sessão restaurada, apenas atualizar estado sem navegar
  const { primaryRole, roles } = extractRolesFromSession(newSession);
  setSession(newSession);
  setUser(newSession.user);
  setRole(primaryRole);
  setAllRoles(roles);
  setLoading(false);
  return;
}
```

### Impacto

| Cenário | Antes | Depois |
|---------|-------|--------|
| Login manual | Vai para /home | Vai para /home ✓ |
| Sessão restaurada (volta aba) | Vai para /home ❌ | Permanece na URL atual ✓ |
| Token refresh | Permanece na URL | Permanece na URL ✓ |

### Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/contexts/AuthContext.tsx` | Ajustar lógica de onAuthStateChange para não navegar em sessão restaurada |

## Resultado Esperado

- Usuário em `/crm/reunioes-equipe` → sai → volta → continua em `/crm/reunioes-equipe`
- Login manual continua funcionando normalmente
- Token refresh continua funcionando normalmente
