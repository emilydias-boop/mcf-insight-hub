
UPDATE public.automation_templates
SET name = 'Confirmação Reunião Agendada — MCF Capital',
    content = E'Olá, {{nome}}. Sua reunião com o especialista da MCF Capital está confirmada.\nData e horário: {{data_hora}}\nEspecialista: {{closer}}\nLink: {{link}}\n\nCaso precise remarcar, responda esta mensagem.\n— MCF Capital',
    variables = ARRAY['nome','data_hora','closer','link'],
    approval_status = 'pending',
    updated_at = now()
WHERE id = '6ce02063-d194-4338-b48c-11cc331aafdb';

DELETE FROM public.automation_templates
WHERE id = 'ffc46592-6cee-4133-aa98-a9cf55ce092a';

INSERT INTO public.automation_templates (name, channel, content, variables, approval_status, is_active)
VALUES (
  'Lembrete D-1 — MCF Capital',
  'whatsapp',
  E'Olá, {{nome}}. Lembrando da sua reunião amanhã com o especialista da MCF Capital.\nData e horário: {{data_hora}}\nEspecialista: {{closer}}\nLink: {{link}}\n\nConfirma sua presença? Em caso de imprevisto, responda esta mensagem.\n— MCF Capital',
  ARRAY['nome','data_hora','closer','link'],
  'pending',
  true
);

INSERT INTO public.automation_templates (name, channel, content, variables, approval_status, is_active)
VALUES (
  'Lembrete M-20 — MCF Capital',
  'whatsapp',
  E'Olá, {{nome}}. Sua reunião com o especialista da MCF Capital começa em 20 minutos.\nLink de acesso: {{link}}\n\nRecomendamos entrar com alguns minutos de antecedência.\n— MCF Capital',
  ARRAY['nome','link'],
  'pending',
  true
);

DO $$
DECLARE
  v_flow_id uuid;
  v_template_id uuid := '6ce02063-d194-4338-b48c-11cc331aafdb';
BEGIN
  INSERT INTO public.automation_flows (name, description, stage_id, origin_id, trigger_on, is_active, respect_business_hours, exclude_weekends)
  VALUES (
    'Confirmação R1 Agendada — Inside Sales (Incorporador)',
    'Envia confirmação WhatsApp quando lead entra em R1 Agendada na Pipeline Inside Sales.',
    'e9ed8f0e-a272-4eba-acc7-434191569282'::uuid,
    'e3c04f21-ba2c-4c66-84f8-b4341c826b1c'::uuid,
    'enter'::automation_trigger,
    false, false, false
  ) RETURNING id INTO v_flow_id;

  INSERT INTO public.automation_steps (flow_id, template_id, channel, anchor, offset_minutes, step_kind, conditions, order_index, is_active)
  VALUES (v_flow_id, v_template_id, 'whatsapp', 'enqueue_time'::automation_anchor, 0,
          'confirmation'::automation_step_kind,
          '{"dedupe_key":"deal_id+stage_id"}'::jsonb, 0, true);

  INSERT INTO public.automation_flows (name, description, stage_id, origin_id, trigger_on, is_active, respect_business_hours, exclude_weekends)
  VALUES (
    'Confirmação R1 Agendada — Anamnese/Indicação (Incorporador)',
    'Envia confirmação WhatsApp quando lead entra em Reunião 01 Agendada no piloto Anamnese/Indicação.',
    'a8365215-fd31-4bdc-bbe7-77100fa39e53'::uuid,
    '7431cf4a-dc29-4208-95a6-28a499a06dac'::uuid,
    'enter'::automation_trigger,
    false, false, false
  ) RETURNING id INTO v_flow_id;

  INSERT INTO public.automation_steps (flow_id, template_id, channel, anchor, offset_minutes, step_kind, conditions, order_index, is_active)
  VALUES (v_flow_id, v_template_id, 'whatsapp', 'enqueue_time'::automation_anchor, 0,
          'confirmation'::automation_step_kind,
          '{"dedupe_key":"deal_id+stage_id"}'::jsonb, 0, true);
END $$;

UPDATE public.meeting_reminder_settings
SET applies_to_bus = ARRAY['incorporador'],
    enabled_offsets = ARRAY['d-1','m-20'],
    apply_to_r1 = true,
    apply_to_r2 = false,
    updated_at = now()
WHERE id = 1;
