
Diagnóstico

Do I know what the issue is? Sim.

- Sim, esse link de recovery vale só uma vez.
- Os logs confirmam isso: houve um `GET /verify` com `303` e login implícito do usuário, e logo depois os novos acessos ao mesmo link retornaram `403 One-time token not found`.
- Então o problema atual é duplo:
  1. o token de recuperação é de uso único por natureza;
  2. a tela `/reset-password` não trata bem o estado de “link já usado/expirado” e fica mostrando “Aguardando verificação...”.
- Também há inconsistência de domínio no fluxo (`mcfgestao.com` aparecendo no navegador e `mcf-insight-hub.lovable.app` no código). Isso aumenta a chance de comportamento confuso no primeiro acesso.

Plano de correção

1. Padronizar um único domínio público para auth/reset
- Escolher um domínio canônico para todo o fluxo de autenticação e usar sempre o mesmo nas funções e no front.
- Atualizar `admin-send-reset`, `create-user` e `AuthContext` para não misturar URLs de reset.

2. Parar de depender do link bruto `/auth/v1/verify`
- Em `supabase/functions/admin-send-reset/index.ts`, gerar o link de recovery mas devolver ao app uma URL própria de reset com os dados necessários do token, em vez de expor diretamente o `action_link`.
- Isso deixa o app controlar a verificação e o estado da tela.

3. Fortalecer a página `ResetPassword`
- Em `src/pages/ResetPassword.tsx`, tratar explicitamente:
  - sessão válida de recovery;
  - `token_hash`/`type=recovery`;
  - erros na URL como `error=access_denied` e `error_code=otp_expired`.
- Quando o link já tiver sido usado, mostrar mensagem clara:
  - “Este link já foi usado ou expirou. Gere um novo link.”
- Não deixar a tela parada em “Aguardando verificação...” nesses casos.

4. Verificar o token uma única vez dentro da página
- Fazer a página trocar/verificar o token ao carregar e, se der certo, liberar o formulário de nova senha.
- Se falhar, entrar em estado de erro explícito, sem tentar reaproveitar o mesmo link.

5. Melhorar a experiência do admin
- Em `src/components/user-management/UserDetailsDrawer.tsx`, deixar o feedback mais claro:
  - “Cada link funciona apenas uma vez.”
  - “Se o usuário já abriu ou o link expirou, gere outro.”
- Manter o fluxo de copiar/compartilhar manualmente, sem abrir o link no navegador do admin.

Arquivos a ajustar

- `supabase/functions/admin-send-reset/index.ts`
- `supabase/functions/create-user/index.ts`
- `src/contexts/AuthContext.tsx`
- `src/pages/ResetPassword.tsx`
- `src/components/user-management/UserDetailsDrawer.tsx`

Resultado esperado

- O primeiro acesso continua funcionando.
- Se o usuário tentar reutilizar o mesmo link, o sistema mostra erro correto em vez de ficar “travado”.
- O admin entende que precisa gerar um novo link para cada nova tentativa.
- Todo o fluxo de reset passa a usar um único domínio e um comportamento previsível.
