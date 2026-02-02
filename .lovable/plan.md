
# Plano: Corrigir Reset de Sessão ao Trocar de Aba

## Diagnóstico

Quando você está em `mcfgestao.com` e troca para outra aba do navegador, ao voltar a aplicação mostra "Acesso Negado" momentaneamente. Isso acontece porque:

### Fluxo Problemático Atual

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. Usuário está logado com role "admin" ou "sdr"                           │
│  2. Troca para outra aba do navegador                                       │
│  3. Volta para a aba do mcfgestao.com                                       │
│  4. Supabase dispara evento SIGNED_IN ou TOKEN_REFRESHED                    │
│  5. handleSession() é chamado e RESETA role para "viewer" temporariamente   │
│  6. RoleGuard/ResourceGuard verificam role = "viewer"                       │
│  7. → MOSTRA "ACESSO NEGADO" enquanto loadRolesInBackground() roda          │
│  8. Após 2-3 segundos, role real é carregada e acesso é liberado            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Evidência nos Logs

```
[Auth] onAuthStateChange: SIGNED_IN
[Auth] handleSession called after 20966ms, session: true
[Auth] Session set, authLoading=false
```

O evento `SIGNED_IN` é disparado mesmo após 20 segundos (quando o token é renovado ou a aba volta ao foco), e o `handleSession` reseta todo o estado de roles.

---

## Solução

Modificar o `AuthContext.tsx` para:

1. **Não resetar roles em eventos de renovação de token** (`SIGNED_IN`, `TOKEN_REFRESHED`)
2. **Preservar roles existentes** quando o usuário já está logado
3. **Apenas recarregar roles se mudou de usuário** ou no login inicial

### Código Corrigido

```typescript
// src/contexts/AuthContext.tsx

// Adicionar ref para rastrear se já temos roles carregadas
const hasLoadedRoles = useRef(false);

// No onAuthStateChange:
const { data: { subscription } } = supabase.auth.onAuthStateChange(
  (event, newSession) => {
    console.log(`[Auth] onAuthStateChange: ${event}`);
    
    // Ignorar INITIAL_SESSION duplicado
    if (event === 'INITIAL_SESSION') {
      if (initialSessionHandled.current) {
        return;
      }
      initialSessionHandled.current = true;
    }
    
    // NOVA LÓGICA: Se é renovação de token e já temos sessão válida, 
    // apenas atualizar tokens sem resetar roles
    if ((event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') && 
        user && 
        newSession?.user?.id === user.id && 
        hasLoadedRoles.current) {
      console.log('[Auth] Token refreshed, keeping existing roles');
      setSession(newSession);
      return; // Não resetar roles!
    }
    
    handleSession(newSession);
  }
);

// No handleSession, marcar que roles foram carregadas:
const loadRolesInBackground = async (userId: string, version: number) => {
  // ... código existente ...
  
  if (roles.length === 0) {
    setRole('viewer');
    setAllRoles(['viewer']);
  } else {
    setRole(primaryRole);
    setAllRoles(roles);
  }
  
  hasLoadedRoles.current = true; // Marcar que roles foram carregadas
  console.log('[Auth] Roles loaded:', { primaryRole, roles });
};

// No signOut, resetar a flag:
const signOut = async () => {
  hasLoadedRoles.current = false;
  // ... resto do código ...
};
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/contexts/AuthContext.tsx` | Adicionar lógica para preservar roles em renovação de token |

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. Usuário está logado com role "admin"                                    │
│  2. Troca para outra aba do navegador                                       │
│  3. Volta para a aba do mcfgestao.com                                       │
│  4. Supabase dispara evento TOKEN_REFRESHED ou SIGNED_IN                    │
│  5. AuthContext DETECTA que é renovação de token (mesmo user.id)            │
│  6. Apenas atualiza tokens na sessão, MANTÉM role "admin"                   │
│  7. → Usuário continua com acesso normal, sem "Acesso Negado"               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Benefícios

| Antes | Depois |
|-------|--------|
| "Acesso Negado" ao voltar de outra aba | Sessão mantida normalmente |
| Role resetada para "viewer" temporariamente | Role preservada |
| UX ruim com flash de tela de erro | Experiência fluida |
| Problemas para SDRs e Closers em abas específicas | Navegação estável |

---

## Detalhes Técnicos

A correção adiciona três verificações antes de resetar roles:

1. **`event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN'`** - É renovação de token?
2. **`user && newSession?.user?.id === user.id`** - Mesmo usuário?
3. **`hasLoadedRoles.current`** - Já carregamos as roles reais?

Se todas são verdadeiras, apenas atualizamos os tokens sem chamar `handleSession()`.
