

## Plano: Corrigir redirecionamento do link de reset de senha

### Problema

Dois problemas identificados:

1. **URL errada**: Os `redirectTo` usam `window.location.origin` (que resolve para `mcf-insight-hub.lovable.app` ou preview do Lovable) em vez de `https://mcfgestao.com`
2. **Sem página de reset**: Não existe rota `/reset-password`. O usuário é redirecionado para `/auth` e logado automaticamente sem conseguir definir a senha

### Locais afetados

| Arquivo | Linha | redirectTo atual |
|---|---|---|
| `src/contexts/AuthContext.tsx` | 372 | `${window.location.origin}/auth` |
| `src/hooks/useUserMutations.ts` | 184 | `${window.location.origin}/auth?mode=reset` |
| `supabase/functions/create-user/index.ts` | 275-277 | `${origin}/auth?mode=reset` |

### Solução

**1. Definir URL canônica** — Usar `https://mcfgestao.com` como domínio fixo em todos os redirects

**2. Criar página `/reset-password`** — Nova rota pública com formulário para definir nova senha:
- Detecta sessão de recovery via `onAuthStateChange` (evento `PASSWORD_RECOVERY`)
- Mostra formulário com nova senha + confirmação
- Chama `supabase.auth.updateUser({ password })` para atualizar
- Redireciona para `/auth` após sucesso

**3. Atualizar todos os redirectTo**:
- `src/contexts/AuthContext.tsx` → `https://mcfgestao.com/reset-password`
- `src/hooks/useUserMutations.ts` → `https://mcfgestao.com/reset-password`
- `supabase/functions/create-user/index.ts` → `https://mcfgestao.com/reset-password`

**4. Adicionar rota em `src/App.tsx`**:
- `<Route path="/reset-password" element={<ResetPassword />} />` (rota pública, fora do layout protegido)

### Arquivos

| Arquivo | Alteração |
|---|---|
| `src/pages/ResetPassword.tsx` | **Novo** — página de definição de senha |
| `src/App.tsx` | Adicionar rota `/reset-password` |
| `src/contexts/AuthContext.tsx` | Alterar redirectTo para `https://mcfgestao.com/reset-password` |
| `src/hooks/useUserMutations.ts` | Alterar redirectTo para `https://mcfgestao.com/reset-password` |
| `supabase/functions/create-user/index.ts` | Alterar origin fallback e redirectTo para `https://mcfgestao.com/reset-password` |

