

# Corrigir Link do Google Meet Abrindo 404

## Problema

O link salvo no banco de dados esta sem o prefixo `https://` (exemplo: `meet.google.com/dqc-hdem-tgr`). Quando o `window.open()` recebe um link sem protocolo, o navegador interpreta como um caminho relativo da aplicacao, resultando em `https://seu-app.lovable.app/meet.google.com/...` -- que gera o erro 404.

## Solucao

Adicionar uma normalizacao simples no `handleOpenVideoConference` e no `handleCopyLink` para garantir que o link sempre tenha `https://` antes de abrir ou copiar.

## Mudanca

**Arquivo**: `src/components/crm/AgendaMeetingDrawer.tsx`

Adicionar uma funcao auxiliar que normaliza o link:

```text
function ensureProtocol(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return 'https://' + url;
}
```

Aplicar nos dois handlers:
- `handleOpenVideoConference`: `window.open(ensureProtocol(videoConferenceLink), '_blank')`
- `handleCopyLink`: `navigator.clipboard.writeText(ensureProtocol(videoConferenceLink))`
- Mensagem WhatsApp: usar `ensureProtocol(videoConferenceLink)` no template

Tambem aplicar no componente `MeetingLinkShare.tsx` que tem logica similar de abertura de link.

