
Objetivo: corrigir o fluxo para que o link de recuperação sempre leve o usuário para a tela de definir senha, em vez de cair no login.

Diagnóstico
- O link de teste está errado para o fluxo atual porque usa `redirect_to=https://mcf-insight-hub.lovable.app/`, ou seja, a raiz do app.
- Quando o Supabase valida o link, ele faz login implícito e redireciona para a URL informada. Se essa URL for `/`, o app cai nas rotas protegidas e pode acabar redirecionando para `/auth`.
- Nos logs de autenticação há dois sinais claros:
  - `/admin/generate_link` está funcionando
  - depois ocorre `GET /verify` com login implícito e, em tentativas seguintes, `One-time token not found`, indicando token já consumido/expirado
- O projeto está inconsistente hoje:
  - `src/pages/ResetPassword.tsx` existe e a rota `/reset-password` existe
  - mas o link manual que você testou aponta para `/`
  - e ainda há código antigo usando `resetPasswordForEmail(... redirectTo: https://mcfgestao.com/reset-password)` em outros pontos

Causa principal
- O problema não é a página `ResetPassword` em si.
- O problema é a URL de redirecionamento usada na geração/compartilhamento do link.
- Além disso, o fluxo atual depende de `PASSWORD_RECOVERY`, mas o Supabase pode restaurar sessão com `SIGNED_IN` após o `/verify`; então a página de reset deve aceitar também sessão válida + presença de parâmetros/hash de recovery.

Plano de correção
1. Padronizar a URL de recovery
- Em `supabase/functions/admin-send-reset/index.ts`, garantir que o `redirectTo` aponte sempre para:
  - `https://mcf-insight-hub.lovable.app/reset-password`
- Não usar `/`
- Não misturar `mcfgestao.com` com `mcf-insight-hub.lovable.app` enquanto o app publicado ativo está no domínio lovable

2. Corrigir todos os pontos antigos que ainda usam URL diferente
- Revisar e alinhar:
  - `src/contexts/AuthContext.tsx` (`resetPassword`)
  - `supabase/functions/create-user/index.ts`
  - qualquer outro ponto que gere link ou envie recuperação
- Todos devem usar exatamente a mesma URL canônica de reset

3. Fortalecer a página `ResetPassword`
- Em `src/pages/ResetPassword.tsx`, mudar a validação de “ready”
- Em vez de depender só de `PASSWORD_RECOVERY`, aceitar:
  - sessão existente após o redirect do Supabase
  - presença de `type=recovery` na URL/hash
  - possíveis tokens/hash retornados pelo Supabase
- Se houver sessão válida de recovery, exibir o formulário imediatamente

4. Evitar redirecionamento indevido para login durante o recovery
- Garantir que `/reset-password` continue pública
- Adicionar lógica para não tratar a navegação de recovery como fluxo normal de login
- Se a sessão existe e a página é `/reset-password`, não empurrar o usuário para `/auth` ou `/home` antes de trocar a senha

5. Ajustar feedback para o admin
- No drawer de usuário, manter apenas “copiar link”
- Mostrar no toast que o link correto deve terminar com `/reset-password`
- Isso evita novo teste manual com URL errada

6. Validar a configuração do Supabase
- Conferir no painel de Auth se a URL publicada e `/reset-password` estão permitidas nas redirect URLs
- Se faltar, adicionar:
  - `https://mcf-insight-hub.lovable.app/reset-password`
  - opcionalmente a URL de preview para testes

Resultado esperado
- O admin gera o link
- O link aponta para `/reset-password`
- O usuário abre o link e cai direto na tela de definir nova senha
- Após salvar, faz logout e volta para `/auth`

Detalhes técnicos
```text
Fluxo correto:
admin -> generateLink(type=recovery, redirectTo=/reset-password)
user -> clica no link /auth/v1/verify?...&redirect_to=https://mcf-insight-hub.lovable.app/reset-password
supabase -> valida token + cria sessão de recovery
app -> abre /reset-password
ResetPassword -> detecta sessão/hash de recovery e mostra formulário
user -> define senha -> signOut -> /auth
```

Arquivos a ajustar
- `supabase/functions/admin-send-reset/index.ts`
- `supabase/functions/create-user/index.ts`
- `src/contexts/AuthContext.tsx`
- `src/pages/ResetPassword.tsx`

Observação importante
- O link que você mandou como teste já explica o erro: ele termina com `redirect_to=https://mcf-insight-hub.lovable.app/`, então ele nunca iria direto para a tela correta. O ajuste principal é padronizar esse redirect para `/reset-password` e endurecer a tela para reconhecer a sessão de recovery.
