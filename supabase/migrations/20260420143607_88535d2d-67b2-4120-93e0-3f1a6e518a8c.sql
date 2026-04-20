-- 1) Adicionar sale.created ao webhook ativo
UPDATE public.outbound_webhook_configs
SET events = ARRAY['sale.created','sale.updated','sale.refunded']
WHERE id = '05222b24-ff4f-484b-b2e1-720afe8a52ae';

-- 2) Enfileirar manualmente as 2 transações do João Vitor
INSERT INTO public.outbound_webhook_queue (config_id, event, transaction_id, payload)
SELECT 
  '05222b24-ff4f-484b-b2e1-720afe8a52ae'::uuid,
  'sale.created',
  t.id,
  public.build_sale_webhook_payload(t, 'sale.created')
FROM public.hubla_transactions t
WHERE t.id IN (
  '5aa224dc-07cd-498c-9309-f6a2c8a96044'::uuid,
  '65419d04-5e1e-47cb-a92c-787d7461ce91'::uuid
);