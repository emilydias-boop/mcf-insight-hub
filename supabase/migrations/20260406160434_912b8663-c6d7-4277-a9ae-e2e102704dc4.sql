ALTER TABLE public.sdr_comp_plan
  ADD COLUMN IF NOT EXISTS meta_comissao_consorcio NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS meta_comissao_holding NUMERIC DEFAULT NULL;