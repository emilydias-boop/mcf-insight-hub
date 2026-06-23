## Diagnóstico

**Cliente:** nestoroshirojr@hotmail.com (contact `2ab53589…`, deal `20ccfca9…` em PIPELINE INSIDE SALES, owner julio.caetano).

- **Contrato pago:** `0c80d60e-306e-4611-8308-b0d72694d289` — A000 - Contrato MCF, offer_name "A000 - Contrato MCF - Construir pra Alugar", em **20/06/2026 20:49** (R$ 388,10), `linked_deal_id = NULL`.
- **R1:** attendee `6cc6f3c9…` foi **criado em 22/06 13:44**, depois do pagamento. R1 marcado com closer Julio para 22/06 16:30, SDR Mayara (`booked_by 29516e9e…`).
- **R2:** attendee `72fa4150…` agendado para 23/06 18:15 com Jessica Martins (status `invited`).

**Por que não contabilizou como Outside:**
1. No momento do `invoice.payment_succeeded` (20/06 20:49) não existia attendee R1 → `autoMarkContractPaid` foi para o fallback Outside.
2. O fallback Outside só dispara quando `isOutsideOffer(offer_name)` é true. A whitelist atual (`OUTSIDE_OFFER_NAMES`) tem apenas `'Contrato - Curso R$ 97,00'` e `'Contrato Perfil A - Vitrine A010'`. A oferta deste contrato — **"A000 - Contrato MCF - Construir pra Alugar"** — não está na lista, então o fluxo abortou: nada de tag Outside, nada de stage Contrato Pago, nada de `linked_deal_id`.
3. Os hooks de dashboard (`useOutsideDetection*`, `useSdrOutsideMetrics`) usam o mesmo `isOutsideOffer` → contrato fica invisível como Outside.
4. Como ninguém marcou o attendee R1 como `contract_paid`, também não conta para Julio (correto: a venda é anterior ao R1).

## Correção

### 1. Whitelist Outside (cliente + edge function)
Adicionar `'A000 - Contrato MCF - Construir pra Alugar'` em:
- `src/hooks/outsideOfferConstants.ts` → `OUTSIDE_OFFER_NAMES`
- `supabase/functions/hubla-webhook-handler/index.ts` (linha 1371) → `OUTSIDE_OFFER_NAMES`

Mantém o match case-insensitive já existente (`toLowerCase().trim()`), então pequenas variações de caixa continuam pegando.

### 2. Backfill do caso Nestor (UPDATE)
Sem mexer no attendee (Julio NÃO deve receber a venda):

```sql
UPDATE hubla_transactions
SET linked_deal_id   = '20ccfca9-3036-4774-94cb-da4dd9e6accf',
    linked_method    = 'manual_outside',
    linked_at        = now()
WHERE id = '0c80d60e-306e-4611-8308-b0d72694d289';

UPDATE crm_deals
SET tags = (SELECT array_agg(DISTINCT t) FROM unnest(coalesce(tags,'{}') || ARRAY['Outside']) t)
WHERE id = '20ccfca9-3036-4774-94cb-da4dd9e6accf';
```

Não altero o `stage_id` (deal está em "Reunião 01 Realizada" e o R1 acontece amanhã — manter o pipeline normal). O dashboard Outside já passa a contar com a regra de offer expandida + `contract_date < meeting_date`.

### 3. Validar
Após o deploy:
- `useOutsideDetection` deve marcar o attendee `6cc6f3c9…` como Outside (contrato 20/06 < reunião 22/06).
- `useSdrOutsideMetrics` deve atribuir +1 Outside para a SDR Mayara (via `booked_by`).
- `closer_meeting_links` / fechamento Julio continuam sem somar esse contrato (attendee.contract_paid_at permanece NULL).

## Notas técnicas

- Nada muda para os outros A000 históricos (CLS, Caução, Incorporador 50k, etc.) — continuam sendo vendas normais com R1.
- Se aparecerem novas ofertas que se comportem como Outside, basta acrescentá-las à constante (única fonte da verdade entre client e edge function).
