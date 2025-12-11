-- =============================================
-- Pipeline de Teste Isolada para Twilio
-- =============================================

-- Criar origem/pipeline de teste
INSERT INTO public.crm_origins (clint_id, name, description)
VALUES (
  'twilio-test-pipeline',
  'Twilio – Teste',
  'Pipeline isolada para testes de softphone Twilio. Não dispara automações de Inside Sales.'
);

-- Criar estágios para a pipeline de teste
INSERT INTO public.crm_stages (clint_id, stage_name, stage_order, origin_id, is_active, color)
SELECT 
  'twilio-stage-1', 'Novo Lead', 1, o.id, true, '#6366f1'
FROM public.crm_origins o WHERE o.name = 'Twilio – Teste';

INSERT INTO public.crm_stages (clint_id, stage_name, stage_order, origin_id, is_active, color)
SELECT 
  'twilio-stage-2', 'Em Contato', 2, o.id, true, '#f59e0b'
FROM public.crm_origins o WHERE o.name = 'Twilio – Teste';

INSERT INTO public.crm_stages (clint_id, stage_name, stage_order, origin_id, is_active, color)
SELECT 
  'twilio-stage-3', 'Qualificado', 3, o.id, true, '#10b981'
FROM public.crm_origins o WHERE o.name = 'Twilio – Teste';

INSERT INTO public.crm_stages (clint_id, stage_name, stage_order, origin_id, is_active, color)
SELECT 
  'twilio-stage-4', 'Convertido', 4, o.id, true, '#22c55e'
FROM public.crm_origins o WHERE o.name = 'Twilio – Teste';