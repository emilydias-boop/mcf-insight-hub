

## Excluir Usuários Duplicados

### Problema
Não existe funcionalidade de exclusão de usuários. Gabriela Fernandes e Robert Roger aparecem duplicados e precisam ser removidos.

### Solução
Criar uma Edge Function `delete-user` (admin-only) que usa `supabase.auth.admin.deleteUser()` e um botão de exclusão no drawer de gerenciamento.

### Mudanças

**1. Nova Edge Function `supabase/functions/delete-user/index.ts`**
- Valida que o caller é admin (mesmo padrão do `create-user`)
- Recebe `{ user_id }` no body
- Limpa dados relacionados: `user_roles`, `user_employment_data`, `user_integrations`, `user_permissions`, `user_targets`, `user_flags`, `user_observations`, `profiles`
- Chama `supabaseAdmin.auth.admin.deleteUser(user_id)` para remover do auth
- Retorna sucesso/erro

**2. Novo hook `useDeleteUser` em `src/hooks/useUserMutations.ts`**
- Mutation que invoca `supabase.functions.invoke("delete-user", { body: { user_id } })`
- Invalida query `["users"]` no sucesso
- Mostra toast de confirmação

**3. Botão no `UserDetailsDrawer.tsx`**
- Adicionar botão "Excluir Usuário" (vermelho, com ícone Trash) na aba de acesso ou no header do drawer
- AlertDialog de confirmação: "Tem certeza? Esta ação é irreversível."
- Ao confirmar, chama `deleteUser` e fecha o drawer

**4. Botão na tabela `GerenciamentoUsuarios.tsx`** (opcional)
- Adicionar ícone de lixeira ao lado de "Gerenciar" para acesso rápido

