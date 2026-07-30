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

## Conferência de sobras (backfill)

`public.get_outside_offer_backfill_pending(p_since timestamptz default now()-30d)` lista compradores de ofertas ativas em `outside_offers` (produto ilike '%contrato%', `completed`) cujo deal em PIPELINE INSIDE SALES está ausente, sem tag `Outside` ou fora de `Contrato Pago`. Já exclui parceiros (A001–A004/A009/INCORPORADOR/ANTICRISE) e `Contrato CLS%`, e casa contato por e-mail ou sufixo de 9 dígitos do telefone. Usar após cada novo lançamento.

Backfill 29/07/2026 (oferta `nPPUxJUzDl5mfa31XpIU`): corrigidos `flavio.leandro@icloud.com` (deal `ec151782…`, saiu de "Sem Interesse") e `adrianodamasio71@gmail.com` (deal novo `70ae78e1…`, distribuído para Mayara Souza). Atividades marcadas com `trigger: outside_backfill_lancamento_2907`.
