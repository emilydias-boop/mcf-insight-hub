---
name: Hubla Checkout Offer = Primary Product
description: A compra primária em checkouts Hubla com múltiplas ofertas vem do offer.id do paymentSession.url (não do event.product nem da UTM).
type: feature
---

## Regra

A "compra primária" de uma invoice Hubla é determinada pelo **offer ID do checkout que o cliente acessou** — extraído de `event.invoice.paymentSession.url` (segmento após `pay.hub.la/`, antes de `?`).

Esse offer define:
- `crm_deals.product_name`
- `crm_deals.name` (sufixo `- A010` ou `- A017`)
- Tag primária (primeira posição em `tags[]`)
- `crm_deals.stage_id`

Sub-invoices (`-offer-N`) com outros produtos viram apenas **tags secundárias** no mesmo deal; nunca mudam stage nem sobrescrevem produto principal.

## Mapeamento de offer IDs

| Offer ID checkout                | Produto primário                  |
| -------------------------------- | --------------------------------- |
| `sSUhrvi36mbjRN8gOwhs`           | A017 (Construir Para Alugar VSL)  |
| `BtqivJFqdCN52oUoYYzc`           | A017 (Construir Para Alugar Manychat) |
| `Rj0oC8BRxMCTJ1UZRpJ3`           | A010 (PRINCIPAL)                  |

## Onde está implementado

`supabase/functions/hubla-webhook-handler/index.ts`:
- `getCheckoutOfferIdFromInvoice(body)` — extrai offer ID da URL.
- `detectA017FromInvoice(body)` — true só quando offer do checkout = A017.
- `createA017Deal` — se existir deal A010 do contato em Inside Sales, **promove** (renomeia, troca product_name, move para `A017_STAGE_ID`, reordena tags `['A017','Hubla','A010', ...]`) em vez de criar duplicata.

## Por que não usar `event.product.id` da invoice pai

A Hubla expõe o offer "PRINCIPAL" como `event.product` na invoice pai mesmo quando o cliente entrou pela VSL A017 (checkout `sSUhrvi36mbjRN8gOwhs`). Só a URL do paymentSession reflete a página real do checkout.