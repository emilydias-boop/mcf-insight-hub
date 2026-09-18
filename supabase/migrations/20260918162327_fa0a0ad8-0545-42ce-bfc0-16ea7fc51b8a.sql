ALTER TABLE public.crm_externo_encaminhamentos
  ADD COLUMN IF NOT EXISTS anamnese_preenchida boolean,
  ADD COLUMN IF NOT EXISTS anamnese_pdf_url text,
  ADD COLUMN IF NOT EXISTS anamnese_estruturada jsonb,
  ADD COLUMN IF NOT EXISTS anamnese_resumo text,
  ADD COLUMN IF NOT EXISTS anamnese_html text,
  ADD COLUMN IF NOT EXISTS anamnese_preenchida_em timestamptz,
  ADD COLUMN IF NOT EXISTS anamnese_atualizada_em timestamptz;