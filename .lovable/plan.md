
# Correção: Race Condition no ResourceGuard

## Problema Identificado

O componente `ResourceGuard` não espera o `loading` do `AuthContext` terminar antes de verificar permissões. Isso causa:

1. Usuário navega para `/crm/negocios`
2. `ResourceGuard` (do pai `/crm`) verifica permissões **imediatamente**
3. `role` ainda é `null` (loading em andamento)
4. `canView` retorna `false` → mostra "Acesso Negado"
5. Após refresh, `loading` já terminou → funciona

O `RoleGuard` não tem esse problema porque **espera o `loading`**:
```typescript
// RoleGuard (correto)
if (loading) {
  return <Spinner />; // Espera!
}
```

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/auth/ResourceGuard.tsx` | Adicionar verificação de `loading` igual ao `RoleGuard` |

---

## Solução

Adicionar verificação de `loading` no `ResourceGuard`:

```typescript
export const ResourceGuard = ({ 
  resource, 
  requiredLevel = 'view',
  children, 
  fallback 
}: ResourceGuardProps) => {
  const { role, loading } = useAuth(); // Adicionar 'loading'
  const { canView, canEdit, canFull } = useResourcePermission(resource);
  
  // NOVO: Esperar o loading terminar antes de verificar permissões
  if (loading) {
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
  
  const hasAccess = /* ... resto do código ... */
```

---

## Alteração Completa

**Arquivo: `src/components/auth/ResourceGuard.tsx`**

**Antes (linha 14-26):**
```typescript
export const ResourceGuard = ({ 
  resource, 
  requiredLevel = 'view',
  children, 
  fallback 
}: ResourceGuardProps) => {
  const { role } = useAuth();
  const { canView, canEdit, canFull } = useResourcePermission(resource);
  
  // Admins sempre têm acesso
  if (role === 'admin') {
    return <>{children}</>;
  }
```

**Depois:**
```typescript
export const ResourceGuard = ({ 
  resource, 
  requiredLevel = 'view',
  children, 
  fallback 
}: ResourceGuardProps) => {
  const { role, loading } = useAuth();
  const { canView, canEdit, canFull } = useResourcePermission(resource);
  
  // Esperar o loading terminar antes de verificar permissões
  if (loading) {
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
```

---

## Resultado Esperado

1. **Navegação**: Ao navegar para `/crm/negocios`, aparece um spinner por ~100-500ms enquanto `loading` é `true`
2. **Após loading**: Quando `role` carrega, verifica permissões corretamente
3. **Sem "Acesso Negado" falso**: O erro não aparece mais durante a navegação

---

## Por Que Funciona Após Refresh?

No refresh, a sequência é diferente:
1. Página recarrega completamente
2. React monta a árvore de componentes
3. `AuthContext` inicia verificação
4. `loading` termina antes do `ResourceGuard` verificar (devido a cache/timing)

Na navegação (SPA), o `ResourceGuard` já está montado e verifica imediatamente quando `role` ainda é `null`.
