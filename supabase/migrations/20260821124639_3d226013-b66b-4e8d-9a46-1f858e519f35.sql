-- 1. "A definir": o dia de vencimento da cota passa a poder ficar em branco,
-- porque quem define é a Embracon depois da abertura.
ALTER TABLE public.consortium_cards ALTER COLUMN dia_vencimento DROP NOT NULL;

-- 2. Backup dos cadastros pendentes com dia de vencimento impossível (ex.: 101520)
CREATE TABLE IF NOT EXISTS public.bkp_dia_vencimento_20260821 (
  id uuid PRIMARY KEY,
  tabela text NOT NULL,
  nome_completo text,
  dia_vencimento_antigo integer,
  backup_em timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.bkp_dia_vencimento_20260821 TO service_role;

ALTER TABLE public.bkp_dia_vencimento_20260821 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver backup de dia_vencimento"
ON public.bkp_dia_vencimento_20260821
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));