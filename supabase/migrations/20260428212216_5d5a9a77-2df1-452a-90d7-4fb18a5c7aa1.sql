UPDATE public.process_rules
SET rule_value = jsonb_build_object('value', null::int),
    updated_at = now()
WHERE bu = 'incorporador'
  AND rule_key IN ('max_meetings_per_week', 'max_noshows_counted');