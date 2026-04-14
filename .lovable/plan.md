

## Plano: Usar email de login (auth) como remetente nos emails de NFSe

### Problema

Os emails de NFSe estao sendo enviados com `email_pessoal` do colaborador como remetente. Esse email pode ser pessoal (ex: gmail), que a Brevo rejeita por nao pertencer ao dominio verificado `@minhacasafinanciada.com`. O correto e usar o email de login (auth), que e o email corporativo cadastrado no Supabase Auth.

### Alteracao

**Dois arquivos afetados:**

1. **`src/components/meu-rh/EnviarNfseModal.tsx`** (funcao `sendNfseEmails`, linha ~44)
   - Buscar o email do usuario logado via `supabase.auth.getUser()` dentro de `sendNfseEmails`
   - Usar esse email como `senderEmail` em vez de `emp.email_pessoal`

2. **`src/components/sdr-fechamento/EnviarNfseFechamentoModal.tsx`** (funcao `sendNfseEmails`, linha ~71)
   - Mesma correcao: buscar `supabase.auth.getUser()` e usar o email de auth como `senderEmail`

### Logica

```ts
// Antes:
const senderEmail = emp.email_pessoal || undefined;

// Depois:
const { data: { user: authUser } } = await supabase.auth.getUser();
const senderEmail = authUser?.email || emp.email_pessoal || undefined;
```

O email de auth (login) e priorizado. Se por algum motivo nao existir, faz fallback para `email_pessoal`. O `brevo-send` ja valida se o email pertence ao dominio `@minhacasafinanciada.com` antes de usa-lo como sender — caso contrario, usa o fallback `marketing@minhacasafinanciada.com`.

### Resultado

Os emails de NFSe serao enviados com o email corporativo do colaborador (o mesmo usado para login), garantindo que a Brevo aceite como remetente verificado.

