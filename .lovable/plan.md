## Situação atual

Hoje **não existe automação de email** disparada após "Cadastrar Dados da Cota". O fluxo do modal `AcceptProposalModal` → `useCreatePendingRegistration` apenas:

1. Marca a proposta como `aceita`
2. Cria o registro em `consorcio_pending_registrations` com status `aguardando_abertura`
3. Faz upload dos documentos

Nenhum `supabase.functions.invoke('brevo-send', ...)` é chamado no fluxo — o único envio de email na base é a função `brevo-send`, usada por notificações de documentos e relatórios.

## O que fazer

Adicionar envio automático de email de boas-vindas ao lead imediatamente após criar o `pending_registration`, usando a função existente `brevo-send`.

### 1. Novo builder de template
Criar `src/lib/consorcioBoasVindasEmail.ts` exportando `buildConsorcioBoasVindasEmail({ nomeCliente })` que retorna `{ subject, htmlContent }`:

- **Assunto:** "Parabéns pela sua nova Carta de Consórcio! Conheça seu time de acompanhamento"
- **HTML:** layout no mesmo padrão do `buildEmailHtml` (header MCF, corpo, footer), com o texto fornecido pelo usuário. Contatos da Emily e Antony renderizados como blocos destacados com WhatsApp clicável (`https://wa.me/5511940652061`, `https://wa.me/5511940284344`) e emails como `mailto:`.

### 2. Disparo no hook
Em `src/hooks/useConsorcioPendingRegistrations.ts`, dentro de `useCreatePendingRegistration.mutationFn`, após o upload dos documentos e antes do `return registration`:

- Determinar `emailDestino` = `input.email` (PF) ou `input.email_comercial` (PJ)
- Determinar `nomeCliente` = `input.nome_completo` (PF) ou `input.razao_social` (PJ)
- Se houver email, invocar (fire-and-forget com `try/catch` para não bloquear sucesso do cadastro):

```ts
await supabase.functions.invoke('brevo-send', {
  body: {
    to: emailDestino,
    name: nomeCliente,
    subject,
    htmlContent,
    tags: ['consorcio_boas_vindas', 'pending_registration'],
  },
});
```

- Logar erro no console e seguir; não estourar toast de erro para o SDR.

### 3. Idempotência
Adicionar coluna `boas_vindas_enviado_em timestamptz` em `consorcio_pending_registrations` (migração) e só disparar quando `null`, marcando `now()` após sucesso. Isso evita reenvio se o SDR reabrir/repetir o fluxo.

### 4. Sem mudanças em UI
O modal e a tela `/consorcio` permanecem iguais. Nenhum controle novo para o usuário — o email é 100% automático.

## Fora do escopo

- Não altera Brevo/sender (continua `marketing@minhacasafinanciada.com`)
- Não envia cópia para Emily/Antony (posso adicionar via `cc` se você quiser — me diga)
- Não cria template no painel Brevo; o HTML é montado no cliente
