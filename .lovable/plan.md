

## Dois ajustes: ver todos os Closers + permitir SDR+Closer simultâneo

### Problema 1: "Nenhum closer cadastrado para outro"

A tela `/crm/configurar-closers` filtra closers pela BU ativa (`activeBU`). Como a Emily (admin) não está dentro de uma rota BU-específica, o `useActiveBU()` cai no fallback `userBUs[0]` — que é `'outro'` (squad pessoal dela), e nenhum closer tem `bu='outro'`. Resultado: lista vazia.

**Correção em `src/pages/crm/ConfigurarClosers.tsx`:**

Para admin/manager, ignorar o filtro de BU quando a rota não for BU-específica. Usar `useIsGlobalCRM()` + `useAuth().role`:

```ts
const isGlobalCRM = useIsGlobalCRM();
const { role } = useAuth();
const isAdminLike = role === 'admin' || role === 'manager';

// Mostrar todos quando admin em rota global, senão filtrar por BU
const filteredClosers = closers?.filter(c => 
  (isGlobalCRM && isAdminLike) ? true : (!activeBU || c.bu === activeBU)
) || [];
```

E ajustar o título do card e o empty state para refletir "Todos" quando não há filtro real. A coluna BU já aparece quando não há `activeBU` aplicado — perfeito para a Emily ver todos e identificar a BU de cada um.

### Problema 2: Migrar usuário de SDR → Closer com período "ambos"

Hoje `useUpdateUserRole` em `src/hooks/useUserMutations.ts` faz `DELETE FROM user_roles WHERE user_id=?` seguido de `INSERT` de **um único** role. O `<Select>` no drawer de usuário também só permite escolher um.

Mas o resto do sistema **já suporta múltiplos roles**:
- `AuthContext` extrai `allRoles[]` do JWT e expõe `hasAnyRole(...)`.
- `RoleGuard`, `useGestorClosers`, `useMyCloser`, `useMyAgendaCapabilities` etc. checam roles individualmente.
- A tabela `user_roles` tem `unique(user_id, role)`, ou seja, suporta N linhas por usuário.

**Mudanças propostas:**

**1. `src/hooks/useUserMutations.ts`** — adicionar mutations granulares (sem quebrar a existente):

```ts
export const useAddUserRole = () => { /* INSERT ... ON CONFLICT DO NOTHING */ };
export const useRemoveUserRole = () => { /* DELETE ... WHERE user_id AND role */ };
```

Manter `useUpdateUserRole` como está (single-role) para fluxos que ainda usam.

**2. `src/hooks/useUsers.ts`** — `useUserDetails` já busca `user_roles`; expor `roles: AppRole[]` (todos os roles do usuário) além do `role` (primário).

**3. `src/components/user-management/UserDetailsDrawer.tsx` — aba Geral**

Substituir o `<Select>` "Role de sistema" (single) por uma nova seção **"Cargos no sistema"**:

```
┌─ Cargos no sistema ──────────────────────────────┐
│ Selecione um ou mais cargos. O cargo de maior   │
│ prioridade vira o "primário" (define dashboards │
│ padrão). Útil em períodos de migração (ex: SDR  │
│ que está virando Closer).                        │
│                                                  │
│  ☑ SDR              [primário]                  │
│  ☑ Closer                                        │
│  ☐ Coordenador                                   │
│  ☐ Manager                                       │
│  ...                                             │
└──────────────────────────────────────────────────┘
```

- Cada checkbox chama `useAddUserRole` ou `useRemoveUserRole` individualmente, com toast.
- Badge "primário" no role com menor `ROLE_PRIORITY` (lógica que o AuthContext já faz).
- Validação: não permitir remover o último role (sempre deve ter pelo menos 1).
- Após qualquer mudança: `invalidateQueries(['user-details', userId])` + `['users']`.

**4. Nota explicativa no header da seção:** "O usuário precisará fazer logout/login para o novo cargo passar a valer (refresh do JWT)." — porque `extractRolesFromSession` lê do token.

### O que NÃO muda

- Schema de `user_roles` (já permite múltiplos).
- RLS, edge functions, JWT injection.
- Nenhuma lógica de métricas/distribuição — quem é SDR continua aparecendo nos KPIs de SDR; quem é Closer aparece nos de Closer; quem é os dois aparece em ambos.
- Vínculo `closers.employee_id` → `employees.user_id` (já é o mecanismo que `useMyCloser` usa para detectar que o usuário é um closer ativo).

### Para a migração concreta (ex: Geison vai virar Closer)

Após o deploy:
1. Criar o registro dele em **Closers** (`/crm/configurar-closers` → Adicionar → vincular `employee_id`).
2. Em `/usuarios` → drawer dele → marcar **☑ Closer** mantendo **☑ SDR**.
3. Ele faz logout/login → passa a ver tanto a Agenda R1 (como SDR) quanto seus dashboards de Closer.
4. Quando a transição terminar, desmarcar **☐ SDR** e desativar o registro de SDR no RH.

### Validação

1. Emily entra em `/crm/configurar-closers` → vê **todos** os closers (com coluna BU visível), não mais "Nenhum closer cadastrado para outro".
2. Outro admin em rota BU-específica (ex: dentro do CRM Consórcio) continua vendo apenas closers daquela BU.
3. Em `/usuarios` → abrir um SDR → marcar Closer → salvar → ver 2 badges no header (SDR + Closer), o de menor prioridade marcado como "primário".
4. Desmarcar o último role → erro "usuário precisa ter ao menos um cargo".
5. Login do usuário migrado → `allRoles` no JWT contém ambos → vê telas de SDR e Closer.

### Escopo

- 1 arquivo editado: `src/pages/crm/ConfigurarClosers.tsx`
- 1 arquivo editado: `src/hooks/useUserMutations.ts` (2 mutations novas)
- 1 arquivo editado: `src/hooks/useUsers.ts` (expor `roles[]`)
- 1 arquivo editado: `src/components/user-management/UserDetailsDrawer.tsx` (substituir select por checkboxes)
- Zero migration de banco
- Zero alteração em RLS, edge functions, JWT, métricas

