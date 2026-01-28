
# Corrigir Acesso de Jessica Martins (Multi-Role: SDR + Closer R2)

## Problemas Identificados

### 1. Negócios: Stages não aparecem
**Causa raiz:** A política RLS da tabela `stage_permissions` usa comparação inválida para usuários com múltiplas roles:

```sql
-- Política atual (QUEBRADA para multi-role)
role = (SELECT user_roles.role FROM user_roles WHERE user_roles.user_id = auth.uid())
```

Quando Jessica (com roles `sdr` E `closer`) acessa, o subquery retorna **2 linhas**, e a comparação `role = (2 linhas)` falha silenciosamente, retornando **0 permissões**.

**Resultado:** `canViewStage()` retorna `false` para todas as stages → Kanban vazio.

### 2. Agenda R2: Sem acesso
**Causa raiz:** O `R2AccessGuard` permite apenas:
- Roles: `admin`, `manager`, `coordenador`
- Usuários específicos (lista hardcoded)

Jessica tem role `closer` (não na lista) e não está na lista de usuários autorizados.

**Resultado:** Jessica vê "Acesso Negado" ao tentar acessar `/crm/agenda-r2`.

---

## Solução

### Parte 1: Corrigir RLS de `stage_permissions` (Banco de Dados)

Atualizar a política para usar `IN` em vez de `=`:

```sql
-- Dropar política existente
DROP POLICY IF EXISTS "Users can view their role permissions" ON stage_permissions;

-- Criar nova política que suporta múltiplas roles
CREATE POLICY "Users can view their role permissions"
ON stage_permissions
FOR SELECT
USING (
  role IN (
    SELECT user_roles.role 
    FROM user_roles 
    WHERE user_roles.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);
```

### Parte 2: Atualizar `R2AccessGuard` para Closers R2

**Arquivo:** `src/components/auth/R2AccessGuard.tsx`

Adicionar verificação para closers com `meeting_type = 'r2'`:

```typescript
// Adicionar 'closer' à lista de roles permitidas
const R2_ALLOWED_ROLES: AppRole[] = ['admin', 'manager', 'coordenador', 'closer'];

// E verificar se é closer R2 válido
const { data: isR2Closer } = useQuery({
  queryKey: ['is-r2-closer', user?.id],
  queryFn: async () => {
    // Buscar via employees.user_id ou por email
    const { data: closer } = await supabase
      .from('closers')
      .select('id')
      .eq('meeting_type', 'r2')
      .eq('is_active', true)
      // ... lógica de match por user_id ou email
    return !!closer;
  },
  enabled: role === 'closer' && !!user?.id,
});
```

### Parte 3: Ajustar `useStagePermissions` para Multi-Role

**Arquivo:** `src/hooks/useStagePermissions.ts`

Modificar o hook para buscar permissões de TODAS as roles do usuário:

```typescript
const { role, allRoles } = useAuth();

// Buscar permissões para TODAS as roles do usuário
const { data: permissions = [] } = useQuery({
  queryKey: ['stage-permissions', allRoles],
  queryFn: async () => {
    if (!allRoles || allRoles.length === 0) return [];
    
    const { data, error } = await supabase
      .from('stage_permissions')
      .select('*')
      .in('role', allRoles); // Buscar para todas as roles
    
    if (error) throw error;
    return data;
  },
  enabled: allRoles && allRoles.length > 0,
});
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| **SQL (Supabase)** | Atualizar política RLS de `stage_permissions` |
| `src/components/auth/R2AccessGuard.tsx` | Adicionar suporte para closers R2 |
| `src/hooks/useStagePermissions.ts` | Usar `allRoles` em vez de `role` |

---

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Jessica no Negócios | Kanban vazio (0 stages) | Stages aparecem normalmente |
| Jessica na Agenda R2 | "Acesso Negado" | Vê suas reuniões R2 |
| Outros usuários single-role | Funciona | Continua funcionando |

---

## Sequência de Implementação

1. **Primeiro:** Corrigir a RLS de `stage_permissions` (resolve Negócios imediatamente)
2. **Segundo:** Atualizar `useStagePermissions` para usar `allRoles` (melhora performance)
3. **Terceiro:** Atualizar `R2AccessGuard` para permitir closers R2 (resolve Agenda R2)

---

## Detalhes Técnicos

### Por que a RLS falha para multi-role?

```sql
-- Para Jessica que tem 2 roles:
SELECT role FROM user_roles WHERE user_id = 'b0ea004d-...'
-- Retorna:
--   'sdr'
--   'closer'

-- A comparação "role = (subquery)" espera 1 valor, mas recebe 2
-- Resultado: condição falha para TODAS as linhas
```

### Por que usar `IN` resolve?

```sql
-- Com IN, funciona para 1 ou mais valores:
role IN (SELECT role FROM user_roles WHERE user_id = auth.uid())
-- Se user tem 'sdr' e 'closer', retorna permissões de AMBAS as roles
```
