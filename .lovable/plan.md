
# Plano de Correção - "Acesso Negado" Intermitente no CRM/Negócios

## Diagnóstico Confirmado

O problema ocorre devido a uma **race condition** entre o carregamento de roles e a verificação de permissões:

```text
Fluxo atual (problemático):
──────────────────────────────────────────────────────────
1. AuthContext: sessão detectada
2. AuthContext: loading=false, role='viewer' (fallback)  ← IMEDIATO
3. ProtectedRoute: libera acesso (user existe)
4. ResourceGuard: verifica permissões com role='viewer'  ← PROBLEMA!
5. useResourcePermission: busca permissões do 'viewer'
6. Resultado: 'viewer' não tem acesso ao CRM → "Acesso Negado"
7. [Background] loadRolesInBackground: role='admin' (correto)
8. Mas a UI já mostrou o erro
──────────────────────────────────────────────────────────

Fluxo após refresh (funciona):
──────────────────────────────────────────────────────────
1. AuthContext: sessão detectada
2. React Query cache já tem a role correta
3. role='admin' (do cache anterior)
4. ResourceGuard: verifica permissões com role='admin'
5. Resultado: acesso concedido ✓
──────────────────────────────────────────────────────────
```

## Solução Proposta

Fazer o `ResourceGuard` **aguardar o `roleLoading` terminar** antes de negar acesso. Enquanto as roles estão carregando, mostrar um loading spinner, não a mensagem de acesso negado.

## Mudanças Necessárias

### Arquivo 1: `src/components/auth/ResourceGuard.tsx`

**Problema atual:**
- Usa apenas `loading` do AuthContext (que agora é só authLoading)
- Não considera `roleLoading` ao verificar permissões

**Correção:**
```typescript
// Antes
const { role, loading } = useAuth();

// Esperar o loading terminar antes de verificar permissões
if (loading) {
  return <Spinner />;
}

// Depois
const { role, loading, roleLoading } = useAuth();

// Esperar AMBOS os loadings terminarem antes de verificar permissões
if (loading || roleLoading) {
  return <Spinner />;
}
```

### Arquivo 2: `src/components/auth/RoleGuard.tsx`

**Mesma correção:**
- Adicionar verificação de `roleLoading` antes de negar acesso

### Arquivo 3: `src/components/auth/R2AccessGuard.tsx`

**Mesma correção:**
- Adicionar verificação de `roleLoading` antes de negar acesso

### Arquivo 4: `src/components/auth/NegociosAccessGuard.tsx`

**Verificar se precisa da mesma correção** (embora atualmente esteja liberado para todos, pode ter condições futuras)

## Detalhes Técnicos

### Alteração no ResourceGuard

```typescript
export const ResourceGuard = ({ 
  resource, 
  requiredLevel = 'view',
  children, 
  fallback 
}: ResourceGuardProps) => {
  const { role, loading, roleLoading } = useAuth();  // ← Adicionar roleLoading
  const { canView, canEdit, canFull } = useResourcePermission(resource);
  
  // Esperar AMBOS loading e roleLoading terminarem
  // Isso evita mostrar "Acesso Negado" enquanto as roles reais estão carregando
  if (loading || roleLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // Admins sempre têm acesso (só verifica após loading terminar)
  if (role === 'admin') {
    return <>{children}</>;
  }
  
  // ... resto do código
};
```

### Alteração no RoleGuard

```typescript
export const RoleGuard = ({ 
  allowedRoles, 
  children, 
  fallback 
}: RoleGuardProps) => {
  const { role, loading, roleLoading, allRoles } = useAuth();  // ← Adicionar roleLoading
  
  // Esperar AMBOS loading e roleLoading terminarem
  if (loading || roleLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // ... resto do código
};
```

## Comportamento Esperado Após Correção

```text
Fluxo corrigido:
──────────────────────────────────────────────────────────
1. AuthContext: sessão detectada
2. AuthContext: loading=false, roleLoading=true, role='viewer' (fallback)
3. ProtectedRoute: libera acesso (user existe)
4. ResourceGuard: roleLoading=true → mostra SPINNER (não "Acesso Negado")
5. [Background] loadRolesInBackground: role='admin' (correto)
6. AuthContext: roleLoading=false, role='admin'
7. ResourceGuard: verifica permissões com role='admin'
8. Resultado: acesso concedido ✓
──────────────────────────────────────────────────────────
```

## Arquivos a Modificar

1. `src/components/auth/ResourceGuard.tsx`
   - Adicionar `roleLoading` do useAuth
   - Mostrar spinner enquanto `roleLoading=true`

2. `src/components/auth/RoleGuard.tsx`
   - Mesma modificação

3. `src/components/auth/R2AccessGuard.tsx`
   - Mesma modificação

## Critérios de Aceite

1. Ao acessar `/crm/negocios`:
   - Durante carregamento: mostrar spinner (não "Acesso Negado")
   - Após roles carregadas: mostrar conteúdo correto baseado na role real

2. Comportamento consistente em:
   - Primeiro acesso (sem cache)
   - Refresh (F5)
   - Navegação interna entre abas

3. Sem regressões:
   - Login/logout continua funcionando
   - Usuários sem permissão real continuam vendo "Acesso Negado" (após roleLoading=false)

## Tempo de Loading Esperado

O `roleLoading` normalmente termina em 1-3 segundos (dependendo do Supabase). Com o timeout de 8s configurado, no pior caso o usuário vê o spinner por até 8 segundos antes de ver o conteúdo (ou fallback para viewer se timeout).
