-- Adicionar campos completos de plano OTE à tabela sdr_levels
ALTER TABLE sdr_levels ADD COLUMN IF NOT EXISTS ote_total NUMERIC DEFAULT 4000;
ALTER TABLE sdr_levels ADD COLUMN IF NOT EXISTS variavel_total NUMERIC DEFAULT 1200;
ALTER TABLE sdr_levels ADD COLUMN IF NOT EXISTS valor_meta_rpg NUMERIC DEFAULT 300;
ALTER TABLE sdr_levels ADD COLUMN IF NOT EXISTS valor_docs_reuniao NUMERIC DEFAULT 300;
ALTER TABLE sdr_levels ADD COLUMN IF NOT EXISTS valor_tentativas NUMERIC DEFAULT 300;
ALTER TABLE sdr_levels ADD COLUMN IF NOT EXISTS valor_organizacao NUMERIC DEFAULT 300;
ALTER TABLE sdr_levels ADD COLUMN IF NOT EXISTS meta_reunioes_agendadas INTEGER DEFAULT 40;
ALTER TABLE sdr_levels ADD COLUMN IF NOT EXISTS meta_reunioes_realizadas INTEGER DEFAULT 30;
ALTER TABLE sdr_levels ADD COLUMN IF NOT EXISTS meta_tentativas INTEGER DEFAULT 300;
ALTER TABLE sdr_levels ADD COLUMN IF NOT EXISTS meta_organizacao INTEGER DEFAULT 100;
ALTER TABLE sdr_levels ADD COLUMN IF NOT EXISTS ifood_mensal NUMERIC DEFAULT 630;
ALTER TABLE sdr_levels ADD COLUMN IF NOT EXISTS ifood_ultrameta NUMERIC DEFAULT 840;
ALTER TABLE sdr_levels ADD COLUMN IF NOT EXISTS dias_uteis INTEGER DEFAULT 22;
ALTER TABLE sdr_levels ADD COLUMN IF NOT EXISTS meta_no_show_pct NUMERIC DEFAULT 30;
ALTER TABLE sdr_levels ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Popular valores proporcionais baseado no nível (fixo_valor já existe)
UPDATE sdr_levels SET 
  ote_total = fixo_valor + 1200,
  variavel_total = 1200,
  valor_meta_rpg = 300,
  valor_docs_reuniao = 300,
  valor_tentativas = 300,
  valor_organizacao = 300,
  meta_reunioes_agendadas = 40,
  meta_reunioes_realizadas = 30,
  meta_tentativas = 300,
  meta_organizacao = 100,
  ifood_mensal = 630,
  ifood_ultrameta = 840,
  dias_uteis = 22,
  meta_no_show_pct = 30,
  updated_at = now()
WHERE ote_total IS NULL OR ote_total = 4000;