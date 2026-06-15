## Objetivo
Consolidar todas as vendas A017 (Construir Para Alugar — VSL + Manychat) no pipeline **PIPELINE INSIDE SALES** ao invés de Viver de Aluguel, tanto para vendas futuras quanto retroativamente.

## Diagnóstico
- O webhook `hubla-webhook-handler` já detecta A017 e cria deal em Inside Sales (stage A017).
- Mas o whitelist `A017_OFFER_IDS` só contém o offer VSL (`sSUhrvi36mbjRN8gOwhs`). Vendas via Manychat (`BtqivJFqdCN52oUoYYzc`) caem no fluxo de orderbump e vão pro pipeline Viver de Aluguel.
- Resultado: dos 61 compradores A017 (01–15/jun), 34 estão em Viver de Aluguel.

## Mudanças

### 1. Webhook routing (`supabase/functions/hubla-webhook-handler/index.ts`)
Adicionar o offer Manychat ao whitelist:
```typescript
const A017_OFFER_IDS = new Set<string>([
  'sSUhrvi36mbjRN8gOwhs', // Construir Para Alugar - VSL
  'BtqivJFqdCN52oUoYYzc', // Construir Para Alugar - Manychat
]);
```
A partir disso, **toda venda A017 (VSL + Manychat)** será roteada pra `INSIDE_SALES_ORIGIN_ID` no stage `A017_STAGE_ID`. O fluxo já existente cuida de:
- Reutilizar contato se existir (dedup por email/phone).
- Não criar deal duplicado em Inside Sales.
- Pular criação de deal em Viver de Aluguel (`isA017Sale && productCategory === 'ob_construir_alugar'`).

### 2. Migração retroativa (script SQL)
Mover os deals históricos de A017 que estão no pipeline Viver de Aluguel pra Inside Sales:

```sql
UPDATE crm_deals
SET 
  origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c'::uuid, -- INSIDE SALES
  stage_id  = '8a0b84d0-7b7a-479a-8c8e-e1067f1a3fda'::uuid  -- A017 stage
WHERE origin_id = '4e2b810a-6782-4ce9-9c0d-10d04c018636'::uuid -- VIVER DE ALUGUEL
  AND contact_id IN (
    SELECT c.id
    FROM crm_contacts c
    JOIN hubla_transactions h ON lower(h.customer_email) = lower(c.email)
    WHERE h.sale_status = 'completed'
      AND h.event_type = 'NewSale'
      AND h.offer_id IN ('sSUhrvi36mbjRN8gOwhs','BtqivJFqdCN52oUoYYzc')
  )
  -- Só migra se NÃO existe já um deal do mesmo contato em Inside Sales
  AND NOT EXISTS (
    SELECT 1 FROM crm_deals d2
    WHERE d2.contact_id = crm_deals.contact_id
      AND d2.origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c'::uuid
  );
```
Para os contatos que já têm deal em Inside Sales (14 sobreposições), o deal de Viver de Aluguel é **apagado** para evitar duplicata:
```sql
DELETE FROM crm_deals
WHERE origin_id = '4e2b810a-6782-4ce9-9c0d-10d04c018636'::uuid
  AND contact_id IN (
    SELECT c.id
    FROM crm_contacts c
    JOIN hubla_transactions h ON lower(h.customer_email) = lower(c.email)
    WHERE h.sale_status='completed' AND h.event_type='NewSale'
      AND h.offer_id IN ('sSUhrvi36mbjRN8gOwhs','BtqivJFqdCN52oUoYYzc')
  )
  AND EXISTS (
    SELECT 1 FROM crm_deals d2
    WHERE d2.contact_id = crm_deals.contact_id
      AND d2.origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c'::uuid
  );
```

### 3. Funil por Canal (`src/hooks/useChannelFunnelReport.ts`)
Com todos os A017 agora em Inside Sales, adicionar a coluna A017 (igual ao plano anterior):
- `CHANNEL_LABELS` → adicionar `A017: 'A017'`.
- Lookup paralelo de A017 buyers (`offer_id IN A017_OFFER_IDS`, `event_type='NewSale'`, `sale_status='completed'`).
- `classifyChannelWith30dRule` ganha parâmetro `isA017Buyer`; prioridade após A010 recente.
- `FUNNEL_CHANNELS` e `blankDetails` incluem `'A017'`.

## Resultado esperado (01–15/jun)
- Funil Incorporador passa a mostrar ~57 entradas em A017 (os 4 sem contato continuam fora).
- Pipeline Viver de Aluguel fica vazio de A017 (só orderbumps continuam lá).
- Total de entradas no funil aumenta porque os 16 deals que estavam só em Viver de Aluguel passam a entrar em Inside Sales.

## Validação
- Após migração: `SELECT COUNT(*) FROM crm_deals WHERE origin_id = '4e2b810a-...' AND contact_id IN (SELECT c.id FROM crm_contacts c JOIN hubla_transactions h ON lower(h.customer_email)=lower(c.email) WHERE h.offer_id IN ('sSUhrvi36mbjRN8gOwhs','BtqivJFqdCN52oUoYYzc'))` deve retornar 0.
- Próxima venda A017 via Manychat: logs do webhook mostram `🎯 [A017 DETECTADO]` e deal criado em Inside Sales.
- Coluna A017 no funil bate com Hubla descontando os 4 buyers sem contato no CRM.
