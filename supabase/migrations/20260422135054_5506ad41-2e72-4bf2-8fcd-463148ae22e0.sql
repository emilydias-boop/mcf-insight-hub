
-- 1) Tabela closer_r1_support_days
CREATE TABLE IF NOT EXISTS public.closer_r1_support_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closer_id uuid NOT NULL REFERENCES public.closers(id) ON DELETE CASCADE,
  support_date date NOT NULL,
  start_time time NULL,
  end_time time NULL,
  notes text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (closer_id, support_date)
);

CREATE INDEX IF NOT EXISTS idx_closer_r1_support_days_closer ON public.closer_r1_support_days(closer_id);
CREATE INDEX IF NOT EXISTS idx_closer_r1_support_days_date ON public.closer_r1_support_days(support_date);

ALTER TABLE public.closer_r1_support_days ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer authenticated (a agenda precisa enxergar pra rotear slots)
DROP POLICY IF EXISTS "support_days_select_authenticated" ON public.closer_r1_support_days;
CREATE POLICY "support_days_select_authenticated"
  ON public.closer_r1_support_days
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: admin, manager, coordenador
DROP POLICY IF EXISTS "support_days_insert_managers" ON public.closer_r1_support_days;
CREATE POLICY "support_days_insert_managers"
  ON public.closer_r1_support_days
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'coordenador'::app_role)
  );

-- UPDATE: mesma regra
DROP POLICY IF EXISTS "support_days_update_managers" ON public.closer_r1_support_days;
CREATE POLICY "support_days_update_managers"
  ON public.closer_r1_support_days
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'coordenador'::app_role)
  );

-- DELETE: mesma regra
DROP POLICY IF EXISTS "support_days_delete_managers" ON public.closer_r1_support_days;
CREATE POLICY "support_days_delete_managers"
  ON public.closer_r1_support_days
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'coordenador'::app_role)
  );

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_closer_r1_support_days_updated_at ON public.closer_r1_support_days;
CREATE TRIGGER trg_closer_r1_support_days_updated_at
  BEFORE UPDATE ON public.closer_r1_support_days
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Coluna is_support_booking em meeting_slots
ALTER TABLE public.meeting_slots
  ADD COLUMN IF NOT EXISTS is_support_booking boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_meeting_slots_is_support_booking
  ON public.meeting_slots(is_support_booking) WHERE is_support_booking = true;
