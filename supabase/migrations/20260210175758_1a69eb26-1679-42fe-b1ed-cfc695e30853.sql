
ALTER TABLE public.team_targets DROP CONSTRAINT team_targets_target_type_check;

ALTER TABLE public.team_targets ADD CONSTRAINT team_targets_target_type_check CHECK (target_type = ANY (ARRAY[
  'sdr_agendamento_dia','sdr_agendamento_semana','sdr_agendamento_mes',
  'sdr_r1_agendada_dia','sdr_r1_agendada_semana','sdr_r1_agendada_mes',
  'sdr_r1_realizada_dia','sdr_r1_realizada_semana','sdr_r1_realizada_mes',
  'sdr_noshow_dia','sdr_noshow_semana','sdr_noshow_mes',
  'sdr_contrato_dia','sdr_contrato_semana','sdr_contrato_mes',
  'sdr_r2_agendada_dia','sdr_r2_agendada_semana','sdr_r2_agendada_mes',
  'sdr_r2_realizada_dia','sdr_r2_realizada_semana','sdr_r2_realizada_mes',
  'sdr_venda_realizada_dia','sdr_venda_realizada_semana','sdr_venda_realizada_mes',
  'ultrameta_clint','faturamento_clint','ultrameta_liquido','faturamento_liquido',
  'weekly_sales','team_revenue','stage_target','sdr_target','closer_target',
  'funnel_stage','team_sales','ultrameta',
  'setor_incorporador_semana','setor_incorporador_mes','setor_incorporador_ano',
  'setor_efeito_alavanca_semana','setor_efeito_alavanca_mes','setor_efeito_alavanca_ano',
  'setor_credito_semana','setor_credito_mes','setor_credito_ano',
  'setor_projetos_semana','setor_projetos_mes','setor_projetos_ano',
  'setor_leilao_semana','setor_leilao_mes','setor_leilao_ano',
  'consorcio_sdr_agendamento_dia','consorcio_sdr_agendamento_semana','consorcio_sdr_agendamento_mes',
  'consorcio_sdr_r1_agendada_dia','consorcio_sdr_r1_agendada_semana','consorcio_sdr_r1_agendada_mes',
  'consorcio_sdr_r1_realizada_dia','consorcio_sdr_r1_realizada_semana','consorcio_sdr_r1_realizada_mes',
  'consorcio_sdr_noshow_dia','consorcio_sdr_noshow_semana','consorcio_sdr_noshow_mes',
  'consorcio_sdr_proposta_enviada_dia','consorcio_sdr_proposta_enviada_semana','consorcio_sdr_proposta_enviada_mes',
  'consorcio_sdr_contrato_dia','consorcio_sdr_contrato_semana','consorcio_sdr_contrato_mes',
  'consorcio_sdr_aguardando_doc_dia','consorcio_sdr_aguardando_doc_semana','consorcio_sdr_aguardando_doc_mes',
  'consorcio_sdr_carta_fechada_dia','consorcio_sdr_carta_fechada_semana','consorcio_sdr_carta_fechada_mes',
  'consorcio_sdr_aporte_dia','consorcio_sdr_aporte_semana','consorcio_sdr_aporte_mes',
  'consorcio_sdr_venda_realizada_dia','consorcio_sdr_venda_realizada_semana','consorcio_sdr_venda_realizada_mes'
]));
