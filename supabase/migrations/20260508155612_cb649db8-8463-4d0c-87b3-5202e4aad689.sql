
ALTER TABLE public.sdr_month_payout
  ADD COLUMN IF NOT EXISTS cargo_mode text NOT NULL DEFAULT 'pro_rata',
  ADD COLUMN IF NOT EXISTS cargo_catalogo_id_fechamento uuid REFERENCES public.cargos_catalogo(id) ON DELETE SET NULL;

ALTER TABLE public.sdr_month_payout
  DROP CONSTRAINT IF EXISTS sdr_month_payout_cargo_mode_check;
ALTER TABLE public.sdr_month_payout
  ADD CONSTRAINT sdr_month_payout_cargo_mode_check
  CHECK (cargo_mode IN ('pro_rata','cargo_unico'));
