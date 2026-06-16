## Objetivo
Fazer com que **todo comprador A017 (Construir Para Alugar — VSL e Manychat) tenha a tag `A017`** no seu deal de `PIPELINE INSIDE SALES`, para que o filtro de tag da Pipeline reflita o total real de vendas A017 da Hubla.

Hoje, em junho/2026:
- 67 compradores A017 únicos na Hubla
- Apenas 46 com deal tagueado A017 no CRM
- Gap de 21 (17 com deal sem a tag + 4 sem deal nenhum)

## Causas confirmadas

Analisando os 17 deals "órfãos":

1. **Detecção A017 estreita demais**: `detectA017FromInvoice` só marca como A017 quando o `paymentSession.url` (checkout) bate com os offer IDs A017. Quando a venda chega só como sub-invoice / orderbump (`ob-construir-alugar`) sem o checkout-offer, o handler nunca entra no fluxo A017 — só cria/atualiza deal com tag `ob-construir-alugar` (ou `A010`).
2. **Promoção restrita a A010**: o bloco 4b só promove deal pré-existente para A017 se ele tiver a tag `A010`. Deals com `[ob-construir-alugar, Hubla, Consórcio]`, `[Lead-Lançamento, base clint]`, etc., ficam sem A017.
3. **Sem retroação**: nenhuma rotina hoje reconcilia deals antigos contra compras A017 já existentes na Hubla.

## Mudanças

### 1. Edge function `hubla-webhook-handler/index.ts`

**(a) Ampliar `detectA017FromInvoice`**

Além do `checkoutOfferId`, classificar como A017 quando o `offer_name` (ou `product_name` consolidado) for exatamente:
- `Construir Para Alugar - VSL`
- `Construir Para Alugar - Manychat kittet`

Manter o filtro por `installment === 1` e a UTM como fallback. Não afeta orderbumps de outros checkouts: a checagem é por nome exato da oferta, não pelo `productCategory` `ob_construir_alugar` (esse continua sendo orderbump puro).

**(b) Generalizar a promoção em `processA017Sale`**

Ordem revista da busca de deal existente em Inside Sales para o mesmo contato/origin:
1. Deal com tag `A017` → atualiza (sem mudanças).
2. Deal com tag `A010` → promove para A017 (já existe).
3. **Novo:** qualquer outro deal do contato em Inside Sales (mais recente, não arquivado) → **adiciona a tag `A017`** (mantém as demais tags, atualiza `custom_fields.a017_compra`, NÃO move de stage e NÃO troca produto/owner, para não atropelar trabalho já feito no deal).
4. Só então cria novo deal A017.

### 2. Migration: backfill único

Script SQL idempotente que, para cada `hubla_transactions` com `offer_name in (...A017...)`:
- Localiza o contato por `lower(email)` ou telefone (últimos 9 dígitos).
- Para deals em `PIPELINE INSIDE SALES` (`origin_id = e3c04f21-...`), não arquivados, que ainda não têm `A017` em `tags`, faz `tags = array_append(tags, 'A017')` e atualiza `custom_fields ||= {a017_backfill: true, a017_data: sale_date}`.
- Não cria deal novo (os ~4 sem deal ficam de fora — exigem investigação individual; lista será exportada para CSV via consulta auxiliar).

### 3. Verificação pós-execução

Reexecutar a consulta de diagnóstico esperando:
- `com_tag_a017 = 63` (mesmo total dos que têm deal hoje).
- Pipeline em junho filtrando por A017 passar de 49 para ~63 oportunidades.

Os 4 compradores sem deal nenhum serão listados para o usuário decidir (provavelmente A010 bloqueado por regra de Inside Sales, email divergente, etc.) — não serão criados automaticamente neste passo.

## Fora de escopo
- Não mexer no filtro de tags da Pipeline (frontend) — passa a ficar correto naturalmente.
- Não mexer no Funil por Canal (já corrigido em iteração anterior).
- Não criar deals para os 4 compradores sem deal — apenas reportar.
