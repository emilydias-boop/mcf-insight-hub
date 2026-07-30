---
name: Ofertas Outside configuráveis
description: A lista de ofertas que qualificam venda "Outside" vive na tabela public.outside_offers (nome OU offer_id); código só tem fallback estático.
type: feature
---

## Regra

Fonte de verdade: `public.outside_offers` (`offer_name`, `offer_id`, `is_active`).
Match por **nome normalizado OU offer_id** — novas ofertas de lançamento (ex.: `nPPUxJUzDl5mfa31XpIU` = "Contrato - Lançamento 29/07") só precisam de uma linha na tabela, sem deploy.

Consumidores:
- `get_outside_detection_for_deals` (RPC)
- `hubla-webhook-handler` → `isOutsideOfferDb()` (fallback estático se a tabela falhar)
- `src/hooks/outsideOfferConstants.ts` → `buildOutsideOfferMatcher()`, usado por `useOutsideDetection` e `useSdrOutsideMetrics`

## Fluxo Outside no webhook

- `autoMarkContractPaid` **não retorna mais cedo** quando não há attendee R1 nos últimos 14 dias — segue para o fluxo Outside.
- Dedupe de contato: e-mail → sufixo de 9 dígitos do telefone. Ao casar por telefone, o e-mail da compra é anexado em `custom_fields.emails_alternativos` (nunca sobrescreve e-mail principal existente).
