-- 1) Adiciona hash da evidência (impede reuso da mesma imagem em múltiplas validações)
ALTER TABLE public.no_show_validations
  ADD COLUMN IF NOT EXISTS evidence_hash text;

CREATE INDEX IF NOT EXISTS idx_no_show_validations_evidence_hash
  ON public.no_show_validations(evidence_hash);

-- 2) Revoga INSERT direto do cliente — só service role pode criar validações
DROP POLICY IF EXISTS "Users can insert their own no-show validations" ON public.no_show_validations;

-- (Mantém SELECT próprio + leadership já existentes)

-- 3) Garante que UPDATE de campos sensíveis fora da liderança seja bloqueado
--    (RLS atual já só dá UPDATE para liderança — reforçamos com revoke explícito)
REVOKE INSERT, UPDATE, DELETE ON public.no_show_validations FROM anon, authenticated;
GRANT  SELECT ON public.no_show_validations TO authenticated;