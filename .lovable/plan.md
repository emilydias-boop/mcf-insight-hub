
# Plano: Adicionar Funcionalidade de Criar Novos Usuários

## Visão Geral

Você poderá criar novos usuários diretamente na página de Gerenciamento de Usuários. O novo usuário receberá um email com um link para definir sua senha e acessar o sistema.

## Fluxo do Usuário

1. Na página de Gerenciamento de Usuários, você clica em **"Adicionar Usuário"**
2. Preenche um formulário com:
   - Nome completo
   - Email
   - Role (SDR, Closer, Admin, etc.)
   - Business Unit (opcional)
3. Clica em "Criar Usuário"
4. O sistema cria a conta e envia automaticamente um email para o novo usuário
5. O novo usuário clica no link do email e define sua própria senha

## Componentes a Serem Criados

### 1. Edge Function: `create-user`

Uma função backend segura que usa a API Admin do Supabase para:
- Criar o usuário na tabela `auth.users`
- O profile é criado automaticamente pelo trigger existente
- Atribuir a role na tabela `user_roles`
- Enviar email de convite com link para criar senha

### 2. Dialog de Criação: `CreateUserDialog`

Modal com formulário contendo:
- Campo de nome completo
- Campo de email (com validação)
- Seletor de role
- Seletor de Business Unit
- Botão de criar

### 3. Hook de Mutation: `useCreateUser`

Hook React Query para chamar a edge function e gerenciar estados de loading/erro.

---

## Detalhes Técnicos

### Edge Function `create-user`

```text
supabase/functions/create-user/
└── index.ts
```

A função irá:
1. Receber: `{ email, full_name, role, squad }`
2. Validar que o usuário chamando é admin
3. Usar `supabase.auth.admin.createUser()` com:
   - `email_confirm: false` - para enviar email de confirmação
   - `user_metadata: { full_name }` - para popular o profile
4. Inserir role na tabela `user_roles`
5. Atualizar squad na tabela `profiles` se informado
6. Retornar sucesso ou erro

### Modificações na Página

**Arquivo:** `src/pages/GerenciamentoUsuarios.tsx`
- Adicionar botão "Adicionar Usuário" no cabeçalho
- Integrar o novo `CreateUserDialog`

**Novo Componente:** `src/components/user-management/CreateUserDialog.tsx`
- Dialog/Modal com formulário
- Validação com Zod
- Integração com o hook de criação

**Novo Hook:** `src/hooks/useUserMutations.ts` (adicionar)
- `useCreateUser` - chama a edge function

### Estrutura do Formulário

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Nome Completo | texto | Sim |
| Email | email | Sim |
| Role | select | Sim |
| Business Unit | select | Não |

### Segurança

- Edge function valida JWT do usuário
- Verifica se o usuário é admin antes de criar
- Usa SUPABASE_SERVICE_ROLE_KEY apenas no backend
- Validação de email no frontend e backend

### Email Enviado

O Supabase enviará automaticamente um email ao novo usuário com:
- Link para confirmar email
- Ao confirmar, usuário é direcionado para a página de login
- Usuário pode usar "Esqueci a senha" para definir sua senha

**Alternativa mais direta:** Usar `resetPasswordForEmail` após criar o usuário para enviar diretamente o link de redefinição de senha.

---

## Resumo dos Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `supabase/functions/create-user/index.ts` |
| Criar | `src/components/user-management/CreateUserDialog.tsx` |
| Editar | `src/hooks/useUserMutations.ts` |
| Editar | `src/pages/GerenciamentoUsuarios.tsx` |
| Editar | `supabase/config.toml` |

## Resultado Esperado

- Botão "Adicionar Usuário" visível na página de gerenciamento
- Modal para preencher dados do novo usuário
- Após criação, usuário aparece na lista com status "Ativo"
- Novo usuário recebe email para definir senha e acessar o sistema
