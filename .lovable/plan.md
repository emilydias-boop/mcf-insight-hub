
# Usar ActiveCampaign para Emails de Notificacao de Documentos

Os secrets `ACTIVECAMPAIGN_API_KEY` e `ACTIVECAMPAIGN_ACCOUNT_URL` ja estao configurados no projeto. A Edge Function `activecampaign-send` tambem ja existe. Basta redirecionar o envio de emails para usar o ActiveCampaign em vez do Resend.

---

## Alteracoes

### 1. Atualizar `src/lib/notifyDocumentAction.ts`

Trocar a funcao `sendDocumentEmail` para invocar `activecampaign-send` em vez de `send-document-email`.

O payload sera adaptado para o formato que a Edge Function do ActiveCampaign espera:
- `email`: endereco do destinatario
- `name`: nome do destinatario
- `subject`: titulo da notificacao
- `content`: HTML do email (o mesmo template visual ja usado)
- `tags`: adicionar tag `notificacao_documento` para rastreamento no ActiveCampaign

### 2. Mover o template HTML para `notifyDocumentAction.ts`

Como o ActiveCampaign recebe o HTML pronto no campo `content`, o template visual do email (header com marca, botao "Ver no Sistema", footer) sera montado no lado do cliente antes de enviar, dentro de uma funcao auxiliar `buildEmailHtml()`.

### 3. Nenhuma alteracao na Edge Function `activecampaign-send`

A Edge Function ja aceita `email`, `name`, `subject`, `content` e `tags` -- exatamente o que precisamos. Nao precisa ser modificada.

### 4. Edge Function `send-document-email` (opcional)

Pode ser mantida como fallback ou removida futuramente. Nenhuma alteracao necessaria agora.

---

## Arquivos afetados

| Arquivo | Acao |
|---------|------|
| `src/lib/notifyDocumentAction.ts` | Alterar para usar `activecampaign-send` com template HTML inline |

## Fluxo Final

```text
Acao do usuario (enviar doc, aceitar termo, etc.)
  --> notifyDocumentAction()
    --> INSERT em user_notifications
    --> invoke('activecampaign-send') para colaborador (com HTML + tag)
    --> invoke('activecampaign-send') para gestor (com HTML + tag)
```

## Vantagens

- Sem necessidade de verificar dominio DNS (ActiveCampaign ja esta configurado)
- Contatos ficam registrados automaticamente no ActiveCampaign
- Tags permitem rastrear quais contatos receberam notificacoes
- Nenhum secret novo necessario
