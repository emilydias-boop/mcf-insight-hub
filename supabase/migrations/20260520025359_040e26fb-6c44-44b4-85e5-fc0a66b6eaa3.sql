
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
  valid_from date,
  valid_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_r2_special_markings_lookup
  ON public.r2_special_markings(closer_r1_employee_id, active);

ALTER TABLE public.r2_special_markings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select r2_special_markings authenticated" ON public.r2_special_markings;
CREATE POLICY "select r2_special_markings authenticated"
  ON public.r2_special_markings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "manage r2_special_markings admins" ON public.r2_special_markings;
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
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_r2_special_markings_updated_at ON public.r2_special_markings;
CREATE TRIGGER trg_r2_special_markings_updated_at
  BEFORE UPDATE ON public.r2_special_markings
  FOR EACH ROW EXECUTE FUNCTION public.tg_r2_special_markings_updated_at();

INSERT INTO public.r2_special_markings (
  id, name, closer_r1_employee_id, required_channel, require_contract_paid,
  bg_color, text_color, icon, badge_label, active, valid_from, valid_until
) VALUES (
  '59de7395-7bf3-4fc3-9006-ff6b1bedc28e',
  'Anamnese - Leticia Faustino',
  '3f298f4e-ab18-4c37-ad01-e90d98cf6189',
  'ANAMNESE',
  true,
  '#7c3aed',
  '#ffffff',
  '📋',
  'Anamnese Leticia',
  true,
  '2026-05-12'::date,
  CURRENT_DATE
)
ON CONFLICT (id) DO UPDATE SET
  valid_until = CURRENT_DATE,
  active = true;
