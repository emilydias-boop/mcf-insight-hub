
CREATE TABLE IF NOT EXISTS public.r2_special_markings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  closer_r1_employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  required_channel text CHECK (required_channel IN ('ANAMNESE','A010','OUTRO') OR required_channel IS NULL),
  require_contract_paid boolean NOT NULL DEFAULT true,
  bg_color text NOT NULL DEFAULT '#7c3aed',
  text_color text NOT NULL DEFAULT '#ffffff',
  icon text NOT NULL DEFAULT '📋',
  badge_label text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_r2_special_markings_lookup
  ON public.r2_special_markings(closer_r1_employee_id, active);

ALTER TABLE public.r2_special_markings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select r2_special_markings authenticated"
  ON public.r2_special_markings FOR SELECT TO authenticated USING (true);

CREATE POLICY "manage r2_special_markings admins"
  ON public.r2_special_markings FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'coordenador')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'coordenador')
  );

CREATE OR REPLACE FUNCTION public.tg_r2_special_markings_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_r2_special_markings_updated_at ON public.r2_special_markings;
CREATE TRIGGER trg_r2_special_markings_updated_at
  BEFORE UPDATE ON public.r2_special_markings
  FOR EACH ROW EXECUTE FUNCTION public.tg_r2_special_markings_updated_at();
