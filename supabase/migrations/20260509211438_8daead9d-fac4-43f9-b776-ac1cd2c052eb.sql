-- Twilio exige prefixo http(s) literal na URL do botão. Trocamos a variável única
-- por uma URL com prefixo fixo + dois placeholders (telefone e texto).
UPDATE public.automation_templates
SET
  buttons_config = jsonb_build_array(
    jsonb_build_object(
      'type', 'url',
      'text', 'Agendar Reunião',
      'url', 'https://wa.me/{{dono_telefone}}?text={{wa_agendar_text}}'
    )
  ),
  variables = ARRAY['nome', 'dono_telefone', 'wa_agendar_text']::text[],
  variable_count = 3,
  twilio_template_sid = NULL,
  approval_status = 'draft',
  approval_submitted_at = NULL,
  approval_updated_at = now(),
  approval_rejected_reason = NULL
WHERE id = 'cf53890c-532d-4c26-9661-f0910152c228';