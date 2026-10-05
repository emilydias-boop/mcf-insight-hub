ALTER TABLE public.crm_externo_encaminhamentos
  DROP CONSTRAINT IF EXISTS crm_externo_encaminhamentos_area_check;

ALTER TABLE public.crm_externo_encaminhamentos
  ADD CONSTRAINT crm_externo_encaminhamentos_area_check
  CHECK (area IN ('consorcio','solar','admissao'));