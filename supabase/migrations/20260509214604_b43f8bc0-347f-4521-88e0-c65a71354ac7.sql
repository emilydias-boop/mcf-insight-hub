UPDATE public.automation_templates
SET buttons_config = jsonb_build_array(
      jsonb_build_object(
        'text', 'Agendar Reunião',
        'type', 'url',
        'url',  'https://rehcfgqvigfcekiipqkc.functions.supabase.co/wa-redirect/{{wa_agendar_token}}'
      )
    ),
    variables           = ARRAY['nome','wa_agendar_token']::text[],
    variable_count      = 2,
    twilio_template_sid = NULL,
    approval_status     = 'draft',
    approval_submitted_at = NULL,
    approval_updated_at = now(),
    updated_at          = now()
WHERE id = 'cf53890c-532d-4c26-9661-f0910152c228';