
# Envio de Email para Notificacoes de Documentos via Resend

## Pre-requisito: Adicionar API Key

O secret `RESEND_API_KEY` ainda nao esta configurado no projeto. Sera solicitado antes de qualquer implementacao.

**Importante**: O email remetente deve usar um dominio verificado no Resend (ex: `notificacoes@seudominio.com.br`). Se ainda nao validou o dominio, faca em https://resend.com/domains.

---

## Implementacao

### 1. Adicionar secret `RESEND_API_KEY`

Solicitar ao usuario via ferramenta de adicao de secrets.

### 2. Criar Edge Function `send-document-email`

**Novo arquivo:** `supabase/functions/send-document-email/index.ts`

Recebe via POST:
- `to`: email do destinatario
- `recipientName`: nome do destinatario
- `subject`: titulo da notificacao
- `message`: mensagem da notificacao
- `action`: tipo da acao (documento_enviado, nfse_enviada, etc.)

Logica:
1. Validar campos obrigatorios
2. Montar HTML do email com template visual (cores da marca, logo)
3. Enviar via Resend API (`npm:resend@4.0.0`)
4. Retornar sucesso/erro

O remetente sera configurado como `MCF Notificacoes <notificacoes@seudominio.com>` (ajustaremos com o dominio verificado).

### 3. Atualizar `notifyDocumentAction.ts`

Apos inserir as notificacoes no banco, buscar os emails dos destinatarios (campo `email_pessoal` ou `email_corporativo` da tabela `employees`) e disparar a Edge Function para cada um.

Alteracoes:
- Expandir o `select` do employee para incluir `email_pessoal, email_corporativo`
- Expandir o `select` do gestor para incluir `email_pessoal, email_corporativo`
- Apos o insert das notificacoes, chamar `supabase.functions.invoke('send-document-email', ...)` para cada destinatario que tenha email
- O envio de email e fire-and-forget (nao bloqueia o fluxo principal)

### 4. Config.toml

Adicionar entrada para a nova edge function:

```text
[functions.send-document-email]
verify_jwt = false
```

---

## Arquivos afetados

| Arquivo | Acao |
|---------|------|
| Secret `RESEND_API_KEY` | Adicionar |
| `supabase/functions/send-document-email/index.ts` | **Novo** - Edge Function de envio |
| `supabase/config.toml` | Adicionar config da nova funcao |
| `src/lib/notifyDocumentAction.ts` | Adicionar disparo de email apos notificacao |

## Template do Email

O email tera um layout limpo e profissional:
- Fundo branco (`#ffffff`)
- Header com nome da empresa
- Titulo da notificacao em destaque
- Mensagem descritiva
- Botao "Ver no Sistema" (link para o app)
- Footer com texto discreto

## Fluxo Completo

```text
Acao do usuario (enviar doc, aceitar termo, etc.)
  --> notifyDocumentAction()
    --> INSERT em user_notifications (colaborador + gestor)
    --> invoke('send-document-email') para email do colaborador
    --> invoke('send-document-email') para email do gestor
```

Ambos recebem: notificacao no sistema + email.
