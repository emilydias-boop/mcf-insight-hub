

## Plano: Corrigir envio de link de reset de senha

### Problema

O botão "Enviar link de reset de senha" no drawer de usuários usa `supabase.auth.resetPasswordForEmail` pelo **client-side** (chave anon). O Supabase aplica rate limit agressivo (~3-4 emails/hora por destinatário) nessa rota. O Antony Nicolas já recebeu vários envios (criação de conta + tentativas manuais), resultando em `429: email rate limit exceeded`.

### Correção (duas partes)

| Componente | O que muda |
|-----------|-----------|
| `supabase/functions/admin-send-reset/index.ts` | Nova Edge Function que usa `supabaseAdmin.auth.admin.generateLink()` para gerar o link de reset via API admin (sem rate limit do SMTP padrão) |
| `src/hooks/useUserMutations.ts` | `useSendPasswordReset` passa a chamar a Edge Function em vez de `supabase.auth.resetPasswordForEmail` diretamente |
| `src/hooks/useUserMutations.ts` | Mensagem de erro amigável quando detectar "rate limit" |

### Detalhes

1. **Edge Function `admin-send-reset`** (novo):
   - Recebe `{ email }` no body
   - Valida que o caller é admin (mesmo padrão do `create-user`)
   - Usa `supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo } })` para gerar o link
   - Envia o email via `supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo })` usando service role (limite mais alto)
   - Retorna sucesso/erro

2. **Hook atualizado**:
   - Chama `supabase.functions.invoke('admin-send-reset', { body: { email } })` em vez da chamada direta
   - Se o erro contiver "rate limit", mostra: "Limite de envios atingido. Aguarde alguns minutos antes de tentar novamente."

3. **Melhoria no aviso de erro**:
   - Toast vermelho com mensagem clara sobre rate limit e orientação para aguardar

### Resultado
- Admin consegue enviar link de reset via API admin (limite muito maior)
- Mensagem de erro clara quando o limite for atingido
- Primeiro login de novos usuários funciona de forma mais confiável

