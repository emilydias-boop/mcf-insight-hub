

## Plano: Página de Gerenciamento de Roles

### Problema Atual
Roles são armazenadas como um **enum Postgres** (`app_role`). Para criar um novo cargo, é necessário rodar SQL manualmente (`ALTER TYPE app_role ADD VALUE`), atualizar labels no código, e configurar permissões. Não existe UI para isso.

### Solução

Criar uma tabela `roles_config` para armazenar metadados de cada role (label, cor, descrição, ativo/inativo), uma edge function que pode adicionar novos valores ao enum via service role, e uma página de administração completa.

---

### 1. Nova tabela: `roles_config`

```sql
CREATE TABLE roles_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key text UNIQUE NOT NULL, -- valor do enum (ex: 'sdr')
  label text NOT NULL,           -- nome amigável (ex: 'SDR')
  color text DEFAULT 'bg-muted text-muted-foreground border-border',
  description text,
  is_system boolean DEFAULT false, -- admin/manager não podem ser removidos
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

Seed com os 10 roles atuais (admin, manager, coordenador, sdr, closer, closer_sombra, financeiro, rh, gr, viewer), marcando admin/manager/viewer como `is_system = true`.

### 2. Edge function: `manage-roles`

- **POST** `/manage-roles` com `{ action: 'create', role_key, label, color, description }`
  - Valida que o caller é admin
  - Executa `ALTER TYPE app_role ADD VALUE IF NOT EXISTS '{role_key}'` via service role SQL
  - Insere na `roles_config`
- **PATCH** para atualizar label/cor/descrição/ativo
- **DELETE** (soft) para desativar (não é possível remover valores de enum Postgres)

### 3. Nova página: `/admin/roles`

Interface com:
- Lista de todos os roles com label, cor, descrição, status (ativo/inativo), badge "Sistema" para roles fixos
- Botão "Novo Cargo" abre dialog com campos: chave (slug), label, cor (seletor), descrição
- Edição inline de label/cor/descrição para roles existentes
- Toggle ativo/inativo (roles de sistema não podem ser desativados)
- Link rápido para a Matriz de Permissões (`/admin/permissoes`) para configurar o que cada role pode ver

### 4. Atualização do sidebar e rotas

- Adicionar item "Cargos" em Administração no sidebar (requiredRoles: admin)
- Adicionar rota `/admin/roles` no App.tsx

### 5. Hook `useRolesConfig`

Query na tabela `roles_config` para buscar roles dinâmicos. Substituir arrays hardcoded de ROLES/ROLE_LABELS na página de Permissões e em outros pontos do sistema por dados desta tabela.

---

### Detalhes técnicos

- O enum Postgres permite `ADD VALUE` mas **não permite remover** valores — por isso a desativação é via flag `is_active` na tabela
- A edge function usa `supabaseAdmin` (service role) para executar o `ALTER TYPE` via `rpc` ou query direta
- O `role_key` deve ser lowercase, sem espaços, sem acentos (slug) — validado no frontend e backend
- Roles do sistema (admin, manager, viewer) têm `is_system = true` e não podem ser editados/desativados

### Arquivos a criar/modificar
- **Criar**: `supabase/functions/manage-roles/index.ts`
- **Criar**: `src/pages/admin/Roles.tsx`
- **Criar**: `src/hooks/useRolesConfig.ts`
- **Modificar**: `src/App.tsx` — adicionar rota `/admin/roles`
- **Modificar**: `src/components/layout/AppSidebar.tsx` — adicionar item "Cargos" no menu admin
- **Modificar**: `src/pages/admin/Permissoes.tsx` — usar `useRolesConfig` em vez de array hardcoded
- **Migration**: criar tabela `roles_config` + seed com roles atuais + RLS policies

