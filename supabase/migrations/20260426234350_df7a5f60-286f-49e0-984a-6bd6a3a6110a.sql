ALTER TABLE public.lead_profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS canal_conhecimento text,
  ADD COLUMN IF NOT EXISTS ja_constroi text,
  ADD COLUMN IF NOT EXISTS experiencia_imobiliaria text,
  ADD COLUMN IF NOT EXISTS interesse_consorcio text,
  ADD COLUMN IF NOT EXISTS situacao_credito text,
  ADD COLUMN IF NOT EXISTS tentou_financiamento text,
  ADD COLUMN IF NOT EXISTS urgencia_operacao text,
  ADD COLUMN IF NOT EXISTS icp_level_name text;