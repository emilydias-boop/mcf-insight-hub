CREATE TABLE IF NOT EXISTS public.bkp_vinculo_deal_20260821 (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null,
  consortium_card_id uuid,
  nome_completo text,
  deal_id_antes uuid,
  deal_id_depois uuid,
  motivo text,
  created_at timestamptz not null default now()
);

GRANT ALL ON public.bkp_vinculo_deal_20260821 TO service_role;

ALTER TABLE public.bkp_vinculo_deal_20260821 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_only_select_bkp_vinculo_deal"
  ON public.bkp_vinculo_deal_20260821 FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));