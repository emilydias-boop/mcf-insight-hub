UPDATE public.sdr_month_payout
SET config_overrides = jsonb_set(
  COALESCE(config_overrides, '{}'::jsonb) - 'dias_uteis_mes',
  '{dias_uteis_trabalhados}', to_jsonb(7)
)
WHERE id = '2623cbce-e9be-432c-baf8-1d2221380719';