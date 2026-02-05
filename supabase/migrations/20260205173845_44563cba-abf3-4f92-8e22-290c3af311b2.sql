-- Adicionar coluna meta_percentual para metas dinâmicas (ex: 30% das Realizadas)
ALTER TABLE fechamento_metricas_mes 
ADD COLUMN meta_percentual numeric DEFAULT NULL;

COMMENT ON COLUMN fechamento_metricas_mes.meta_percentual IS 
  'Percentual para cálculo dinâmico da meta (ex: 30 = 30% das Realizadas para Contratos)';