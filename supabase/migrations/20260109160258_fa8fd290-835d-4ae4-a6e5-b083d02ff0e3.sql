-- Drop the old constraint
ALTER TABLE public.team_targets DROP CONSTRAINT team_targets_target_type_check;

-- Create new constraint with all SDR target types
ALTER TABLE public.team_targets ADD CONSTRAINT team_targets_target_type_check CHECK (
  target_type = ANY (ARRAY[
    'funnel_stage'::text, 
    'ultrameta'::text, 
    'closer'::text, 
    'sdr'::text, 
    'team_revenue'::text, 
    'team_sales'::text,
    -- SDR Day targets
    'sdr_agendamento_dia'::text, 
    'sdr_r1_agendada_dia'::text, 
    'sdr_r1_realizada_dia'::text, 
    'sdr_noshow_dia'::text, 
    'sdr_contrato_dia'::text,
    'sdr_r2_agendada_dia'::text,
    'sdr_r2_realizada_dia'::text,
    'sdr_venda_realizada_dia'::text,
    -- SDR Week targets
    'sdr_agendamento_semana'::text, 
    'sdr_r1_agendada_semana'::text, 
    'sdr_r1_realizada_semana'::text, 
    'sdr_noshow_semana'::text, 
    'sdr_contrato_semana'::text,
    'sdr_r2_agendada_semana'::text,
    'sdr_r2_realizada_semana'::text,
    'sdr_venda_realizada_semana'::text,
    -- SDR Month targets
    'sdr_agendamento_mes'::text, 
    'sdr_r1_agendada_mes'::text, 
    'sdr_r1_realizada_mes'::text, 
    'sdr_noshow_mes'::text, 
    'sdr_contrato_mes'::text,
    'sdr_r2_agendada_mes'::text,
    'sdr_r2_realizada_mes'::text,
    'sdr_venda_realizada_mes'::text
  ])
);