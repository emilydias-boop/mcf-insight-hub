INSERT INTO public.outbound_webhook_configs (
  name,
  description,
  url,
  method,
  headers,
  events,
  sources,
  product_categories,
  is_active,
  secret_token
) VALUES (
  'Vendas Reais — Debug webhook.site',
  'Webhook de debug apontando para webhook.site. Recebe sale.created, sale.updated e sale.refunded de todas as origens.',
  'https://webhook.site/bc01d8da-f2d2-44d0-8a1a-a76a044f0953',
  'POST',
  '{"Content-Type": "application/json"}'::jsonb,
  ARRAY['sale.created', 'sale.updated', 'sale.refunded'],
  ARRAY['hubla', 'kiwify', 'mcfpay', 'asaas', 'make', 'manual'],
  NULL,
  true,
  NULL
);