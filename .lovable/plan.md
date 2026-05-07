## Problema

O fluxo atual gera um link de recuperação OTP do Supabase. Esse link é de **uso único** — quando você cola no WhatsApp/email/Slack, o pré-visualizador desses apps abre o link automaticamente para gerar a prévia, **consumindo o token antes do usuário clicar**. Resultado: quando o usuário abre, aparece "link expirado/já utilizado" e ele fica bloqueado.

## Solução escolhida: Definir senha temporária direto

Trocar o botão "Gerar link de reset de senha" por **"Definir senha temporária"**. O admin define (ou gera automaticamente) uma senha, ela é aplicada imediatamente ao usuário via `auth.admin.updateUserById`, e o admin a copia para enviar pelo canal que quiser. Como é uma senha (não um token), nenhum preview de WhatsApp consegue invalidá-la.

## O que muda

### 1. Edge function `admin-send-reset` → renomear/refatorar para `admin-set-temp-password`

- Continua exigindo que o caller seja admin.
- Recebe `{ user_id }` (e opcionalmente uma senha customizada).
- Gera uma senha temporária forte e legível (ex: `Mcf-7K9p-2024`, 12 chars com letras+números+hífen).
- Chama `supabaseAdmin.auth.admin.updateUserById(user_id, { password })`.
- Retorna `{ success: true, temp_password }`.

### 2. Drawer de detalhes do usuário (`UserDetailsDrawer.tsx` aba Segurança)

- Substituir o botão "Gerar link de reset de senha" por **"Definir senha temporária"**.
- Ao clicar:
  - Confirma com `AlertDialog` ("Isso vai sobrescrever a senha atual do usuário. Continuar?").
  - Chama a nova mutation.
  - Mostra a senha em um modal com botão "Copiar senha" + instrução: *"Envie esta senha ao usuário pelo canal de sua preferência. Peça para ele trocar em Configurações → Segurança após o primeiro login."*
  - Senha permanece visível até o admin fechar o modal (com opção mostrar/ocultar).

### 3. Hook `useUserMutations.ts`

- Substituir `sendPasswordReset` por `setTempPassword` que invoca a nova edge function.

### 4. Limpeza

- Remover/deprecar a edge function `admin-send-reset` (ou deixar como redirecionamento legado).
- Sem mudanças em `/reset-password` — a página continua funcionando para usuários que pedem reset pelo próprio fluxo "Esqueci minha senha".

## Fora de escopo

- Não mexer no fluxo público de "Esqueci minha senha" do `/auth`.
- Não enviar email automático (você optou por copiar e enviar manualmente).
- Sem mudanças de schema no banco.

## Detalhes técnicos

- Geração de senha: 12 caracteres, sem caracteres ambíguos (`0/O/l/1/I`), formato `Xxx-9999-Xxxx` para facilitar leitura.
- A nova edge function NÃO precisa novos secrets — usa `SUPABASE_SERVICE_ROLE_KEY` já disponível.
- A senha trocada invalida sessões ativas do usuário automaticamente (comportamento padrão do Supabase Auth ao mudar senha via admin API).
