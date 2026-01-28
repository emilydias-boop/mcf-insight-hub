
# Correção Crítica: "Acesso Negado" para Todos os Usuários

## Diagnóstico do Problema

### Causa Raiz Confirmada
**O bug afeta TODOS os usuários, não apenas a Jessica Martins.** A evidência confirma que:

1. **Jessica Martins tem 2 roles**: `{sdr, closer}` (user_id: `b0ea004d...`)
2. **O `AuthContext.tsx` usa `.single()`** na linha 38:
   ```typescript
   const { data, error } = await supabase
     .from('user_roles')
     .select('role')
     .eq('user_id', userId)
     .single();  // ← FALHA quando retorna 2+ linhas
   ```

3. **Quando `.single()` falha**, a função `fetchUserRole` retorna `null` (linha 41-42)
4. **Com `role = null`**, TODOS os guards de segurança bloqueiam acesso:
   - `RoleGuard`: Verifica `!role || !allowedRoles.includes(role)` → **bloqueia**
   - `ResourceGuard`: Chama `useResourcePermission` que verifica `if (!role)` → **retorna "none"** → **bloqueia**
   - Até mesmo o **admin perde acesso** porque `role = null`

### Por Que Afeta TODOS os Usuários?

Quando a Jessica faz login ou quando o `AuthContext` atualiza a sessão dela:
1. O `.single()` falha com erro "multiple rows returned"
2. O `fetchUserRole` retorna `null`
3. O estado global `setRole(null)` é aplicado
4. A aplicação **React pode causar re-renders em cascata** afetando outros componentes

**IMPORTANTE**: Mesmo usuários SEM múltiplas roles podem ser afetados porque:
- Se houver um erro JS não tratado, o `loading` pode travar
- Se o erro acontecer durante o `onAuthStateChange`, pode corromper o estado global
- O Twilio context também usa hooks que dependem do `AuthContext`

### Evidências do Session Replay
O session replay confirmou:
- Erro: "Acesso Negado" mostrado para admin
- Bloqueio durante ligações Twilio (porque o TwilioContext depende do `useAuth()`)

---

## Solução Proposta

### Arquitetura de Prioridade de Roles

Quando um usuário tem múltiplas roles, o sistema irá:
1. Buscar **todas as roles** (sem `.single()`)
2. Aplicar uma **tabela de prioridade**
3. Usar a role de **maior prioridade** como "role principal"
4. (Opcional) Armazenar **todas as roles** para verificações granulares

#### Tabela de Prioridade

| Prioridade | Role | Descrição |
|------------|------|-----------|
| 1 | `admin` | Acesso total (sempre vence) |
| 2 | `manager` | Gestão |
| 3 | `coordenador` | Coordenação de equipe |
| 4 | `closer` | Reuniões e fechamento |
| 5 | `closer_sombra` | Observer de reuniões |
| 6 | `financeiro` | Acesso financeiro |
| 7 | `rh` | Recursos humanos |
| 8 | `sdr` | Qualificação de leads |
| 9 | `viewer` | Apenas visualização |

**Exemplo**: Jessica Martins tem `{sdr, closer}` → Sistema usará `closer` (prioridade 4)

---

## Implementação

### 1. Corrigir `AuthContext.tsx`

**Arquivo**: `src/contexts/AuthContext.tsx`

**Mudanças**:
- Adicionar constante `ROLE_PRIORITY`
- Modificar `fetchUserRole` para buscar **todas as roles** e aplicar prioridade
- Remover `.single()`, substituir por query sem limite + sort manual

**Novo código**:

```typescript
// Adicionar no topo do arquivo (após imports)
const ROLE_PRIORITY: Record<string, number> = {
  admin: 1,
  manager: 2,
  coordenador: 3,
  closer: 4,
  closer_sombra: 5,
  financeiro: 6,
  rh: 7,
  sdr: 8,
  viewer: 9,
};

// Modificar fetchUserRole (linhas 33-46)
const fetchUserRole = async (userId: string) => {
  // Buscar TODAS as roles do usuário
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching user roles:', error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  // Se tem múltiplas roles, escolher a de maior prioridade
  const roles = data.map(r => r.role as AppRole);
  const sortedRoles = roles.sort((a, b) => 
    (ROLE_PRIORITY[a] || 99) - (ROLE_PRIORITY[b] || 99)
  );
  
  return sortedRoles[0]; // Role de maior prioridade
};
```

**Impacto**: 
- Jessica Martins: `role = 'closer'` (prioridade 4)
- Outros usuários: Mesma lógica, mas como só têm 1 role, nada muda
- Elimina o erro de `.single()` que causava `role = null`

---

### 2. Corrigir `useUsers.ts`

**Arquivo**: `src/hooks/useUsers.ts`

**Linha atual**: 37-43 (usa `.single()`)

**Problema**: Mesmo erro se usuário tem múltiplas roles

**Solução**: Aplicar mesma lógica de prioridade

```typescript
// Linha 37-43: Substituir
const { data: roleData, error: roleError } = await supabase
  .from("user_roles")
  .select("role")
  .eq("user_id", userId);

// Se há erro que não seja "nenhuma linha"
if (roleError && roleError.code !== "PGRST116") throw roleError;

// Determinar role principal por prioridade
const ROLE_PRIORITY: Record<string, number> = {
  admin: 1, manager: 2, coordenador: 3, closer: 4,
  closer_sombra: 5, financeiro: 6, rh: 7, sdr: 8, viewer: 9,
};

const primaryRole = roleData?.length 
  ? roleData.sort((a, b) => 
      (ROLE_PRIORITY[a.role] || 99) - (ROLE_PRIORITY[b.role] || 99)
    )[0].role 
  : null;
```

---

### 3. Corrigir `useAvailableProfiles.ts`

**Arquivo**: `src/hooks/useAvailableProfiles.ts`

**Linha atual**: 98-100 (usa `.maybeSingle()`)

**Problema**: Se o profile tiver múltiplas roles, `.maybeSingle()` falha

**Solução**:

```typescript
// Linha 98-100: Substituir
const { data: userRoles, error: roleError } = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', profileId);

if (roleError) throw roleError;

const ROLE_PRIORITY: Record<string, number> = {
  admin: 1, manager: 2, coordenador: 3, closer: 4,
  closer_sombra: 5, financeiro: 6, rh: 7, sdr: 8, viewer: 9,
};

const primaryRole = userRoles?.length
  ? userRoles.sort((a, b) => 
      (ROLE_PRIORITY[a.role] || 99) - (ROLE_PRIORITY[b.role] || 99)
    )[0].role
  : null;
```

---

### 4. (Opcional) Adicionar `allRoles` ao AuthContext

**Vantagem**: Permite verificações mais granulares (`hasRole('sdr')` E `hasRole('closer')` para Jessica)

**Mudança**:

```typescript
// No AuthState (linha 9-14)
interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole | null;      // Role principal (maior prioridade)
  allRoles: AppRole[];       // NOVO: Todas as roles do usuário
  loading: boolean;
}

// No useState (linha 29)
const [allRoles, setAllRoles] = useState<AppRole[]>([]);

// No fetchUserRole
const fetchUserRole = async (userId: string) => {
  // ... código anterior ...
  
  // Armazenar TODAS as roles
  setAllRoles(roles);
  
  return sortedRoles[0];
};

// Modificar hasRole (linha 222-232)
const hasRole = (requiredRole: AppRole): boolean => {
  if (allRoles.includes('admin')) return true; // Admin tem tudo
  return allRoles.includes(requiredRole);      // Verifica qualquer role
};
```

**Impacto**: Jessica Martins poderá acessar tanto funcionalidades de `sdr` quanto de `closer`

---

## Arquivos a Modificar

| Arquivo | Mudança | Criticidade |
|---------|---------|-------------|
| `src/contexts/AuthContext.tsx` | Adicionar `ROLE_PRIORITY`, remover `.single()`, aplicar sort | 🔴 CRÍTICA |
| `src/hooks/useUsers.ts` | Mesma lógica (linha 37-43) | 🔴 CRÍTICA |
| `src/hooks/useAvailableProfiles.ts` | Mesma lógica (linha 98-100) | 🟡 IMPORTANTE |
| `src/contexts/AuthContext.tsx` (allRoles) | Adicionar array de todas as roles | 🟢 OPCIONAL |

---

## Verificação Pós-Implementação

### Testes Críticos

1. **Login da Jessica Martins**:
   - Role deve ser `'closer'` (prioridade 4)
   - Deve ter acesso a: `/crm/agenda-r2`, `/crm/reunioes-equipe`, `/sdr/minhas-reunioes`
   - Console não deve mostrar erros de `.single()`

2. **Login de Admin**:
   - Role deve ser `'admin'`
   - Acesso total mantido
   - Nenhum "Acesso Negado"

3. **Login de SDR normal** (sem múltiplas roles):
   - Role deve ser `'sdr'`
   - Comportamento idêntico ao anterior
   - Nenhuma regressão

4. **Twilio durante ligação**:
   - Não deve travar mais
   - `TwilioContext` deve funcionar normalmente (depende de `useAuth`)

### Checklist de Segurança

- [ ] `RoleGuard` funciona corretamente com role única
- [ ] `RoleGuard` funciona corretamente com múltiplas roles (Jessica)
- [ ] `ResourceGuard` não bloqueia admin
- [ ] `ResourceGuard` usa role correta para verificar permissões
- [ ] Console não mostra erros de "multiple rows returned"

---

## Considerações Técnicas

### Por Que Não Modificar o Banco?

**NÃO** vamos modificar o banco de dados porque:
1. O sistema DEVE suportar múltiplas roles (design correto)
2. O problema está na **lógica de query** (`.single()`), não no schema
3. A constraint `user_roles_user_id_role_key (user_id, role)` já existe e está correta

### Por Que Usar Prioridade?

Alternativas consideradas:
- **Concatenar roles** (`"sdr,closer"`) → Quebra tipo `AppRole`
- **Usar apenas primeira role** → Não garante consistência
- **Escolher dinamicamente** → Complexo demais

**Prioridade é ideal porque**:
- Transparente: Admin sempre vence, Manager > SDR, etc.
- Previsível: Sempre mesma role para mesmo usuário
- Extensível: Fácil adicionar novas roles

### Impacto no `hasRole()`

Com `allRoles[]`:
```typescript
// Antes (só verifica role principal)
hasRole('sdr') // false para Jessica (role = 'closer')

// Depois (verifica todas)
hasRole('sdr') // true para Jessica (sdr está em allRoles)
hasRole('closer') // true para Jessica (closer está em allRoles)
```

**Vantagem**: Jessica pode acessar tanto páginas de SDR quanto de Closer

---

## Resumo Executivo

**Problema**: `.single()` falha quando usuário tem múltiplas roles, causando `role = null` → "Acesso Negado" para TODOS.

**Solução**: Buscar todas as roles, aplicar prioridade, usar a mais alta como role principal.

**Impacto**: Bug crítico corrigido, Jessica Martins pode ter dupla função, sistema mais robusto.

**Tempo estimado**: 15-20 minutos de implementação + 10 minutos de testes.
