ALTER TABLE public.sdr_month_payout
  ADD COLUMN IF NOT EXISTS componentes_conta text NOT NULL DEFAULT 'fixo_variavel';
ALTER TABLE public.sdr_month_payout
  DROP CONSTRAINT IF EXISTS sdr_month_payout_componentes_conta_check;
ALTER TABLE public.sdr_month_payout
  ADD CONSTRAINT sdr_month_payout_componentes_conta_check
  CHECK (componentes_conta IN ('fixo_variavel','somente_fixo'));