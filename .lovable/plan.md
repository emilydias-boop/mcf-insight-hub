
# Plano: Corrigir Bug de Roles Ficando Permanentemente como "Viewer"

## Problema Identificado

O usuário Thobson está com role `coordenador` no banco, mas a interface mostra "Viewer". Isso acontece porque:

1. O `loadRolesInBackground` tem timeout de 8s com fallback para `viewer`
2. Se ocorrer timeout, ele ainda marca `hasLoadedRoles.current = true`
3. Em eventos subsequentes (TOKEN_REFRESHED, navegação), o sistema pula a recarga porque pensa que já tem os roles corretos
4. O usuário fica permanentemente preso como "Viewer"

### Fluxo do Bug:

```text
┌─────────────────────────────────────────────────────────────────────┐
│  1. Login/navegação inicial                                         │
│  2. handleSession → define roleLoading=true                         │
│  3. loadRolesInBackground inicia                                    │
│  4. Query demora > 8s (rede lenta/servidor ocupado)                 │
│  5. Timeout! Fallback: role='viewer'                                │
│  6. hasLoadedRoles.current = true ← ERRO! Marca como carregado      │
│                                                                     │
│  7. Usuário navega ou tab focus → TOKEN_REFRESHED                   │
│  8. Código verifica: hasLoadedRoles.current = true                  │
│  9. Pula handleSession → mantém role='viewer' permanentemente ❌    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Solução

### 1. Não marcar como carregado se usou fallback do timeout

**Arquivo:** `src/contexts/AuthContext.tsx`

**Modificar linhas 159-177:**

```typescript
// Fetch roles with timeout
const roleResult = await withTimeout(
  fetchUserRoles(userId),
  ROLE_TIMEOUT_MS,
  null // fallback: null indica timeout
);

if (version !== roleLoadVersion.current) return;

// Se timeout ocorreu, usar viewer MAS não marcar como carregado
if (roleResult === null) {
  console.warn('[Auth] Role fetch timed out, using viewer temporarily');
  setRole('viewer');
  setAllRoles(['viewer']);
  // NÃO definir hasLoadedRoles.current = true aqui!
  // Isso permite que roles sejam recarregadas em próximo evento
  return;
}

const { primaryRole, roles } = roleResult;

if (roles.length === 0) {
  setRole('viewer');
  setAllRoles(['viewer']);
} else {
  setRole(primaryRole);
  setAllRoles(roles);
}

// Só marcar como carregado se realmente buscou do banco
hasLoadedRoles.current = true;
console.log('[Auth] Roles loaded:', { primaryRole, roles });
```

### 2. Forçar recarga se role atual é 'viewer' mas há sessão válida

**Arquivo:** `src/contexts/AuthContext.tsx`

**Modificar lógica de TOKEN_REFRESHED (linhas 254-262):**

```typescript
// Preserve roles during token refresh - don't reset if same user
// BUT: if roles weren't properly loaded (still viewer), try again
if ((event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') && 
    user && 
    newSession?.user?.id === user.id) {
  
  // Se hasLoadedRoles é false, significa que houve timeout anterior
  // Tentar carregar novamente
  if (!hasLoadedRoles.current) {
    console.log('[Auth] Token refreshed but roles not loaded, reloading...');
    const myVersion = ++roleLoadVersion.current;
    setRoleLoading(true);
    setTimeout(() => {
      loadRolesInBackground(newSession.user.id, myVersion);
    }, 0);
  } else {
    console.log('[Auth] Token refreshed, keeping existing roles');
  }
  setSession(newSession);
  return;
}
```

---

## Resumo de Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/contexts/AuthContext.tsx` | 1. Usar `null` como fallback em vez de viewer object |
| | 2. Não definir `hasLoadedRoles.current = true` em caso de timeout |
| | 3. Re-tentar carregar roles em TOKEN_REFRESHED se `hasLoadedRoles = false` |

---

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Timeout na primeira carga | Fica viewer permanentemente | Viewer temporário, recarrega depois |
| TOKEN_REFRESHED com timeout anterior | Mantém viewer errado | Re-tenta carregar roles |
| Carga normal (sem timeout) | OK | Mantém igual |

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────┐
│  1. Login inicial                                                   │
│  2. Query demora > 8s → timeout                                     │
│  3. role='viewer' (temporário), hasLoadedRoles=false                │
│                                                                     │
│  4. Usuário muda de tab → TOKEN_REFRESHED                           │
│  5. Código verifica: hasLoadedRoles = false                         │
│  6. Re-inicia loadRolesInBackground                                 │
│  7. Desta vez query retorna: 'coordenador'                          │
│  8. hasLoadedRoles = true                                           │
│  9. UI atualiza: "Coordenador" ✓                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Nota Importante

**Thobson com role `coordenador` não deveria acessar `/usuarios` mesmo após correção** - a tabela `role_permissions` mostra que `coordenador` tem `permission_level: none` para o recurso `usuarios`. Isso é comportamento esperado.

Após a correção, a sidebar vai mostrar "Coordenador" (não "Viewer"), mas ele ainda verá "Acesso Negado" na página `/usuarios` porque não tem permissão.
