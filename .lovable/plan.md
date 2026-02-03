
# Plano: Roles Automáticas no JWT Token

## Objetivo
Eliminar completamente o "Acesso Negado" indevido incluindo as roles do usuário diretamente no token JWT. Isso torna o acesso **instantâneo** sem necessidade de queries adicionais.

## Arquitetura Atual vs Nova

```text
ATUAL (Com Race Condition):
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Login     │ ──► │   Token     │ ──► │ Query Roles │ ──► Acesso
│             │     │ (sem roles) │     │ (delay/timeout)│
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
                                     "Acesso Negado" se timeout

NOVA (Sem Race Condition):
┌─────────────┐     ┌─────────────────────┐
│   Login     │ ──► │ Token (COM roles!)  │ ──► Acesso Instantâneo
│             │     │ {user_roles: [...]} │
└─────────────┘     └─────────────────────┘
```

## Etapas de Implementação

### Etapa 1: Criar a Função de Hook no Banco

Criar uma função `custom_access_token_hook` que será executada automaticamente pelo Supabase Auth toda vez que um token é gerado. Esta função:

1. Busca as roles do usuário na tabela `user_roles`
2. Injeta as roles nas claims do JWT
3. Retorna o token modificado

**SQL a executar:**
```sql
-- Função que injeta roles no JWT
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  user_roles text[];
BEGIN
  -- Busca todas as roles do usuário
  SELECT array_agg(role::text) INTO user_roles
  FROM public.user_roles
  WHERE user_id = (event->>'user_id')::uuid;

  -- Pega as claims existentes
  claims := event->'claims';
  
  -- Adiciona roles ao token (array vazio se não tiver roles)
  claims := jsonb_set(claims, '{user_roles}', to_jsonb(COALESCE(user_roles, ARRAY[]::text[])));
  
  -- Retorna o evento com as claims modificadas
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Permissões necessárias para o serviço de auth
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Revogar acesso do public e anon (segurança)
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM anon;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated;
```

### Etapa 2: Habilitar o Hook no Dashboard do Supabase

Após criar a função, será necessário habilitá-la manualmente no painel do Supabase:

1. Acessar: Authentication → Hooks
2. Encontrar "Customize Access Token (JWT)"
3. Habilitar e selecionar a função `custom_access_token_hook`
4. Salvar

### Etapa 3: Criar Função Helper para Decodificar JWT

Criar um utilitário para extrair as roles do token de forma segura:

**Arquivo:** `src/utils/jwt.ts`

```typescript
export interface JWTPayload {
  user_roles?: string[];
  sub?: string;
  exp?: number;
  iat?: number;
}

export const decodeJWTPayload = (token: string): JWTPayload | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (error) {
    console.error('[JWT] Failed to decode token:', error);
    return null;
  }
};

export const getRolesFromToken = (accessToken: string | undefined): string[] => {
  if (!accessToken) return [];
  
  const payload = decodeJWTPayload(accessToken);
  return payload?.user_roles || [];
};
```

### Etapa 4: Simplificar AuthContext

Modificar `AuthContext.tsx` para:

1. Ler roles diretamente do token (sem query)
2. Remover `roleLoading` (não é mais necessário)
3. Manter `checkUserBlocked` para segurança (bloqueio é diferente de permissão)

**Principais mudanças:**

```typescript
// Remover:
- fetchUserRoles()
- loadRolesInBackground()
- roleLoading state
- hasLoadedRoles ref
- ROLE_TIMEOUT_MS constant

// Adicionar:
+ import { getRolesFromToken } from '@/utils/jwt';

// Novo handleSession (simplificado):
const handleSession = (newSession: Session | null) => {
  if (!newSession?.user) {
    setSession(null);
    setUser(null);
    setRole(null);
    setAllRoles([]);
    setLoading(false);
    return;
  }

  // Roles vêm direto do token - INSTANTÂNEO!
  const roles = getRolesFromToken(newSession.access_token) as AppRole[];
  const sortedRoles = roles.length > 0 
    ? [...roles].sort((a, b) => (ROLE_PRIORITY[a] || 99) - (ROLE_PRIORITY[b] || 99))
    : ['viewer' as AppRole];
  
  setSession(newSession);
  setUser(newSession.user);
  setRole(sortedRoles[0]);
  setAllRoles(sortedRoles.length > 0 ? sortedRoles : ['viewer']);
  setLoading(false);
  
  // Verificar bloqueio em background (não bloqueia UI)
  checkUserBlockedInBackground(newSession.user.id);
};
```

### Etapa 5: Atualizar Guards e Hooks

Remover referências a `roleLoading` nos componentes:

**Arquivos a modificar:**
- `src/components/auth/ResourceGuard.tsx` - remover `roleLoading` do check
- `src/components/auth/RoleGuard.tsx` - remover `roleLoading` do check
- Outros guards que usam `roleLoading`

### Etapa 6: Atualizar Interface AuthContextType

```typescript
interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  allRoles: AppRole[];
  loading: boolean; // Apenas session loading
  // REMOVIDO: roleLoading
}
```

## Considerações Importantes

### Quando as roles são atualizadas no token?

| Evento | Token Atualizado? |
|--------|-------------------|
| Login | Sim, token novo |
| Token Refresh (automático ~1h) | Sim |
| Mudança de role no banco | Não, precisa re-login ou refresh |

### Forçar atualização de roles (opcional)

Se precisar atualizar roles sem logout, pode-se chamar:
```typescript
await supabase.auth.refreshSession();
```

### Segurança mantida

- `checkUserBlocked` continua funcionando em background
- Se usuário for bloqueado, ainda será deslogado
- RLS no banco continua validando permissões

## Resumo das Mudanças

| Arquivo | Ação |
|---------|------|
| Migration SQL | Criar função `custom_access_token_hook` |
| Dashboard Supabase | Habilitar hook manualmente |
| `src/utils/jwt.ts` | Criar (novo arquivo) |
| `src/contexts/AuthContext.tsx` | Simplificar removendo roleLoading |
| `src/components/auth/ResourceGuard.tsx` | Remover check de roleLoading |
| `src/components/auth/RoleGuard.tsx` | Remover check de roleLoading |

## Resultado Esperado

- Login → Acesso instantâneo (0ms de delay para roles)
- Sem "Acesso Negado" indevido
- Código mais simples e manutenível
- Menos queries no banco
