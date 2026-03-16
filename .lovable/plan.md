

## Plano: Corrigir criação de usuário, duplicação e exclusão de lead

### 1. Fix CORS nas Edge Functions (causa do "Failed to fetch")

**Arquivos**: `supabase/functions/create-user/index.ts`, `supabase/functions/delete-user/index.ts`

Atualizar `corsHeaders` em ambos para incluir headers do supabase-js v2:
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
```

### 2. Fix duplicação de usuários na lista

**Arquivo**: `supabase/functions/create-user/index.ts`

O trigger `auto_assign_first_admin` insere automaticamente uma role `viewer` quando o auth user é criado. Depois a função insere outra role (ex: `sdr`). Resultado: 2 roles = 2 linhas na view `user_performance_summary`.

**Correção**: Antes de inserir a role correta, deletar todas as roles automáticas do usuário recém-criado:
```typescript
// Delete auto-assigned roles from trigger
await supabaseAdmin.from("user_roles").delete().eq("user_id", newUser.user.id);
// Then insert correct role
await supabaseAdmin.from("user_roles").insert({ user_id: newUser.user.id, role });
```

### 3. Fix envio de email de senha

**Arquivo**: `supabase/functions/create-user/index.ts`

Substituir `admin.generateLink` (que apenas gera mas não envia) por `inviteUserByEmail` ou `resetPasswordForEmail`. Como o user já foi criado com `email_confirm: true`, usar `resetPasswordForEmail` via admin client para disparar o email:
```typescript
const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
  redirectTo: `${origin}/auth?mode=reset`,
});
```

### 4. Fix exclusão de lead

**Arquivo**: `src/hooks/useCRMData.ts` (`useDeleteCRMDeal`)

O delete direto em `crm_deals` pode falhar por FK constraints (tabelas filhas como `deal_activities`, `meeting_slot_attendees`, etc.) ou por RLS (policy exige admin).

**Correção**: Antes de deletar o deal, limpar registros dependentes:
```typescript
// Delete dependents first
await supabase.from('deal_activities').delete().eq('deal_id', id);
await supabase.from('deal_tasks').delete().eq('deal_id', id);
await supabase.from('meeting_slot_attendees').delete().in('meeting_slot_id', slotIds);
await supabase.from('meeting_slots').delete().eq('deal_id', id);
// Then delete the deal
await supabase.from('crm_deals').delete().eq('id', id);
```

Também melhorar a mensagem de erro para ser mais descritiva.

### Resumo de arquivos alterados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/create-user/index.ts` | Fix CORS, fix duplicação (delete roles antes de inserir), fix email (usar resetPasswordForEmail) |
| `supabase/functions/delete-user/index.ts` | Fix CORS headers |
| `src/hooks/useCRMData.ts` | Limpar dependências antes de deletar deal |

### Deploy necessário
As edge functions `create-user` e `delete-user` precisarão ser re-deployadas após as alterações.

