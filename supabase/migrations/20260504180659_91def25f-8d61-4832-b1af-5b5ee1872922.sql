
CREATE TABLE public.no_show_blocked_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid,
  meeting_slot_id uuid,
  attendee_id uuid,
  evidence_hash text,
  evidence_path text,
  lead_phone text,
  lead_name text,
  attempted_by uuid NOT NULL,
  attempt_reason text NOT NULL CHECK (attempt_reason IN ('duplicate_hash','duplicate_active')),
  conflicting_validation_id uuid,
  conflicting_deal_id uuid,
  ai_verdict text,
  meeting_type text,
  bu_origin_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_nsba_deal ON public.no_show_blocked_attempts(deal_id);
CREATE INDEX idx_nsba_attempted_by ON public.no_show_blocked_attempts(attempted_by);
CREATE INDEX idx_nsba_created ON public.no_show_blocked_attempts(created_at DESC);

ALTER TABLE public.no_show_blocked_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth insert blocked attempts"
  ON public.no_show_blocked_attempts FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "self read own blocked attempts"
  ON public.no_show_blocked_attempts FOR SELECT
  TO authenticated USING (attempted_by = auth.uid());

CREATE POLICY "managers read all blocked attempts"
  ON public.no_show_blocked_attempts FOR SELECT
  TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'coordenador'::app_role)
  );
