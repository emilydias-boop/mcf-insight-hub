---
name: webhook-lead-receiver normaliza payload Hubla
description: O webhook-lead-receiver detecta automaticamente payloads Hubla (header x-hubla-token ou event.user) e extrai email/name/phone/document/product_name para o root antes da validação, sem precisar configurar field_mapping manualmente.
type: feature
---
Detecção: header `x-hubla-token` presente OU `payload.event.user` existe.

Mapeamento (merge não-destrutivo no root, só preenche se vazio):
- `email` ← `payload.event.user.email`
- `name` ← `${firstName} ${lastName}` trim (fallback firstName)
- `phone` ← `payload.event.user.phone`
- `document` ← `payload.event.user.document` (CPF, útil para dedupe)
- `product_name` ← `payload.event.product.name`
- `hubla_event_type` ← `payload.type`

Significa que **novos infoprodutos Hubla** podem usar `/webhook-lead-receiver/<slug>` sem configurar `field_mapping`. Não afeta integrações Make/Manychat/Alfredo/Anamnese (não-Hubla).

Origem: bug A017 - Construir Para Alugar (70 chamadas falhando com "Campos obrigatórios: name, email").