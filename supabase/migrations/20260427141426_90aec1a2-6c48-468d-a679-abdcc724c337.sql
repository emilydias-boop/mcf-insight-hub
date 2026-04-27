-- 1. Mover deal para Contrato Pago + adicionar tag Outside
UPDATE public.crm_deals 
SET 
  stage_id = '062927f5-b7a3-496a-9d47-eb03b3d69b10',
  tags = CASE 
    WHEN tags IS NULL THEN ARRAY['Outside']::text[]
    WHEN NOT ('Outside' = ANY(tags)) THEN array_append(tags, 'Outside')
    ELSE tags
  END,
  updated_at = now()
WHERE id = '756d66fb-fda5-45ca-b046-2056c58db3d6';

-- 2. Vincular as transações Hubla de contrato ao deal
UPDATE public.hubla_transactions
SET linked_deal_id = '756d66fb-fda5-45ca-b046-2056c58db3d6'
WHERE customer_email = 'jrnogueira67@gmail.com'
  AND product_name ILIKE '%contrato%'
  AND linked_deal_id IS NULL
  AND linked_attendee_id IS NULL;

-- 3. Atividade no histórico do deal
INSERT INTO public.deal_activities (deal_id, activity_type, description, metadata)
VALUES (
  '756d66fb-fda5-45ca-b046-2056c58db3d6',
  'stage_change',
  'Correção manual: movido para Contrato Pago como Outside (pagamento Curso R$ 97,00 sem R1 prévia)',
  jsonb_build_object(
    'distribution_type', 'outside_owner_kept',
    'contact_email', 'jrnogueira67@gmail.com',
    'offer_name', 'Contrato - Curso R$ 97,00',
    'trigger', 'manual_backfill_outside',
    'moved_to_stage', '062927f5-b7a3-496a-9d47-eb03b3d69b10'
  )
);

-- 4. Notificar SDR responsável
INSERT INTO public.user_notifications (user_id, type, title, message, metadata, read)
VALUES (
  'f12d079b-8c99-49b4-9233-4705886e079b',
  'contract_paid',
  '💰 Contrato Pago Outside - Verifique seus leads',
  'ANTONIO JOSÉ MATOS NOGUEIRA JÚNIOR pagou contrato Outside (Contrato - Curso R$ 97,00). Verifique e dê o tratamento devido.',
  jsonb_build_object(
    'deal_id', '756d66fb-fda5-45ca-b046-2056c58db3d6',
    'customer_name', 'ANTONIO JOSÉ MATOS NOGUEIRA JÚNIOR',
    'customer_email', 'jrnogueira67@gmail.com',
    'sale_date', '2026-04-22T00:12:44.019+00:00',
    'offer_name', 'Contrato - Curso R$ 97,00',
    'trigger', 'contract_paid_outside_no_r1'
  ),
  false
);