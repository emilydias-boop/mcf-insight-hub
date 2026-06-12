---
name: Outside & A010 Late Installment Flow
description: hubla-webhook-handler cria deal em Inside Sales para A010 em qualquer parcela e cria+distribui deal Outside quando não existe deal prévio para o pagamento de contrato.
type: feature
---

## Regras de criação/distribuição em PIPELINE INSIDE SALES

1. **A010 cria deal em qualquer parcela** (`hubla-webhook-handler`): `createOrUpdateCRMContact` é chamado para todo `invoice.payment_succeeded` A010, não só `installment === 1`. A tabela `a010_sales` continua sendo upsert só na parcela 1. Dedupe interno por `contact_id + origin_id` garante 1 deal só.

2. **Contrato Outside sem deal cria deal + distribui** (`autoMarkContractPaid` no Hubla): quando não há R1 e `offer_name ∈ OUTSIDE_OFFER_NAMES`:
   - Resolve origin com `ilike 'PIPELINE INSIDE SALES'` (match exato — sem `%...%` para não pegar `PIPELINE INSIDE SALES - LEAD GRATUITO`).
   - Cria contato se não existir (dedupe por email + sufixo 9 dígitos do telefone).
   - Se contato não tem deal em Inside Sales, cria deal novo, distribui via `get_next_lead_owner`, tag `Outside`, stage `Contrato Pago` (fallback `Novo Lead`), vincula transação Hubla via `linked_deal_id`, notifica SDR.
   - Se deal existe: comportamento legado (tag Outside + stage Contrato Pago + distribui se sem owner).

3. **`distribute-outside-leads`** também usa match exato `ilike 'PIPELINE INSIDE SALES'` ordenado por `created_at ASC` para resolver origin canônico.

## Caso reparado

`gabrielarthurrei@gmail.com` (contact `616536b5-...`) — deal manual criado `5341478d-d97f-4bc8-a255-1c7bcb8f8605` atribuído a Mayara Souza, 3 transações Hubla vinculadas.