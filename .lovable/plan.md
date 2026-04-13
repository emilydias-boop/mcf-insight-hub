

## Plano: Remetente individual quando email @mcf verificado no Brevo

### Contexto

O Brevo exige que o `sender.email` seja um remetente verificado na plataforma. Pelo print, dois emails estao verificados:
- `matheus.rodrigues@minhacasafinanciada.com`
- `marketing@minhacasafinanciada.com`

A ideia e: se o colaborador tiver email `@minhacasafinanciada.com`, usar esse email como remetente real. Caso contrario, usar `marketing@` como fallback.

### Logica

O dominio `minhacasafinanciada.com` esta com DKIM e DMARC configurados no Brevo, entao qualquer email `@minhacasafinanciada.com` pode ser usado como remetente (o Brevo aceita envios de qualquer endereco do dominio verificado, nao apenas os listados individualmente).

### Alteracoes

**1. `supabase/functions/brevo-send/index.ts`**
- Aceitar campos opcionais `senderEmail` e `senderName` no body da request
- Se `senderEmail` for informado e terminar com `@minhacasafinanciada.com`, usar como `sender.email` e `senderName` como `sender.name`
- Caso contrario, manter `MCF Gestao` / `marketing@minhacasafinanciada.com` como fallback
- Adicionar `replyTo` com o email do colaborador quando `senderEmail` for fornecido

**2. `src/components/meu-rh/EnviarNfseModal.tsx`**
- Na funcao `sendNfseEmails`, buscar `email_pessoal` do colaborador (ja busca)
- Passar `senderEmail` e `senderName` nas chamadas ao `brevo-send`

**3. `src/components/sdr-fechamento/EnviarNfseFechamentoModal.tsx`**
- Mesma alteracao: passar dados do colaborador como remetente

**4. `src/lib/notifyDocumentAction.ts`**
- Na funcao `sendDocumentEmail`, aceitar e repassar `senderEmail`/`senderName` opcionais ao `brevo-send`
- Quando a acao for do colaborador (`sentBy: 'colaborador'`), passar o email do colaborador como remetente

### Exemplo de payload resultante

Quando Matheus envia uma NFSe:
```json
{
  "sender": {
    "name": "Matheus Rodrigues",
    "email": "matheus.rodrigues@minhacasafinanciada.com"
  },
  "replyTo": {
    "email": "matheus.rodrigues@minhacasafinanciada.com",
    "name": "Matheus Rodrigues"
  }
}
```

Quando um colaborador sem email @mcf envia:
```json
{
  "sender": {
    "name": "MCF Gestão",
    "email": "marketing@minhacasafinanciada.com"
  },
  "replyTo": {
    "email": "colaborador@gmail.com",
    "name": "Nome do Colaborador"
  }
}
```

### Arquivos afetados

| Acao | Arquivo |
|------|---------|
| Editar | `supabase/functions/brevo-send/index.ts` |
| Editar | `src/components/meu-rh/EnviarNfseModal.tsx` |
| Editar | `src/components/sdr-fechamento/EnviarNfseFechamentoModal.tsx` |
| Editar | `src/lib/notifyDocumentAction.ts` |

Apos as alteracoes, redeploy da function `brevo-send`.

