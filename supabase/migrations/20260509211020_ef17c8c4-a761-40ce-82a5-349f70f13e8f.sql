-- Fix template "Boa Vindas": URL do botão usava {{dono_link_wa}} (que já é a URL completa,
-- causando https://wa.me/https://wa.me/...). Trocamos pela nova variável
-- {{dono_link_wa_agendar}} que já vem com texto pré-preenchido conforme o papel do dono.
UPDATE public.automation_templates
SET
  buttons_config = jsonb_build_array(
    jsonb_build_object(
      'type', 'url',
      'text', 'Agendar Reunião',
      'url', '{{dono_link_wa_agendar}}'
    )
  ),
  variables = ARRAY['nome', 'dono_link_wa_agendar']::text[],
  variable_count = 2,
  twilio_template_sid = NULL,
  approval_status = 'draft',
  approval_submitted_at = NULL,
  approval_updated_at = now(),
  approval_rejected_reason = NULL
WHERE id = 'cf53890c-532d-4c26-9661-f0910152c228';