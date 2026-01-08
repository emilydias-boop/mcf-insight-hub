-- Drop the existing constraint
ALTER TABLE public.team_targets DROP CONSTRAINT IF EXISTS team_targets_target_type_check;

-- Recreate with all allowed target types including new SDR types
ALTER TABLE public.team_targets
ADD CONSTRAINT team_targets_target_type_check
CHECK (
  target_type = ANY (ARRAY[
    'funnel_stage','ultrameta','closer','sdr','team_revenue','team_sales',
    'sdr_agendamento_dia','sdr_r1_agendada_dia','sdr_r1_realizada_dia','sdr_noshow_dia','sdr_contrato_dia',
    'sdr_agendamento_semana','sdr_r1_agendada_semana','sdr_r1_realizada_semana','sdr_noshow_semana','sdr_contrato_semana'
  ])
);