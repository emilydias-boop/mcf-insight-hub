CREATE TABLE IF NOT EXISTS public.process_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bu TEXT NULL,
  role TEXT NOT NULL CHECK (role IN ('sdr', 'closer')),
  rule_key TEXT NOT NULL,
  rule_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS process_rules_unique_idx
  ON public.process_rules (COALESCE(bu, '__global__'), role, rule_key);

CREATE INDEX IF NOT EXISTS process_rules_lookup_idx
  ON public.process_rules (role, rule_key, bu) WHERE is_active = true;

ALTER TABLE public.process_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access process_rules"
  ON public.process_rules FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read active process_rules"
  ON public.process_rules FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE TABLE IF NOT EXISTS public.rule_approval_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bu TEXT,
  rule_key TEXT NOT NULL,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_role TEXT NOT NULL CHECK (requester_role IN ('sdr', 'closer')),
  target_deal_id UUID REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rule_approval_pending_idx
  ON public.rule_approval_requests (status, bu, created_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS rule_approval_requester_idx
  ON public.rule_approval_requests (requested_by, status, created_at DESC);

ALTER TABLE public.rule_approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requester reads own approval requests"
  ON public.rule_approval_requests FOR SELECT
  USING (auth.uid() = requested_by);

CREATE POLICY "Requester creates own approval requests"
  ON public.rule_approval_requests FOR INSERT
  WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "Requester cancels own pending"
  ON public.rule_approval_requests FOR UPDATE
  USING (auth.uid() = requested_by AND status = 'pending')
  WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "Approvers read all approval requests"
  ON public.rule_approval_requests FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coordenador')
    OR public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Approvers update approval requests"
  ON public.rule_approval_requests FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coordenador')
    OR public.has_role(auth.uid(), 'manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coordenador')
    OR public.has_role(auth.uid(), 'manager')
  );

CREATE TRIGGER process_rules_set_updated_at
  BEFORE UPDATE ON public.process_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER rule_approval_set_updated_at
  BEFORE UPDATE ON public.rule_approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_process_rule(
  _bu TEXT,
  _role TEXT,
  _rule_key TEXT
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rule_value
  FROM public.process_rules
  WHERE role = _role
    AND rule_key = _rule_key
    AND is_active = true
    AND (bu = _bu OR bu IS NULL)
  ORDER BY (bu IS NOT NULL) DESC
  LIMIT 1;
$$;

INSERT INTO public.process_rules (bu, role, rule_key, rule_value, description) VALUES
  (NULL, 'sdr', 'max_meetings_per_week', '{"value": 2}'::jsonb, 'Máximo de agendamentos R1 contabilizados por SDR no lead/semana (null = ilimitado)'),
  (NULL, 'sdr', 'max_noshows_counted', '{"value": 2}'::jsonb, 'Máximo de no-shows contabilizados por SDR no lead'),
  (NULL, 'sdr', 'reschedule_approval_threshold', '{"value": null}'::jsonb, 'A partir de qual reagendamento exige aprovação (null = desativado)'),
  (NULL, 'closer', 'max_meetings_per_week', '{"value": 2}'::jsonb, 'Máximo de agendamentos R2 contabilizados por Closer no lead/semana'),
  (NULL, 'closer', 'max_noshows_counted', '{"value": 2}'::jsonb, 'Máximo de no-shows contabilizados por Closer no lead'),
  (NULL, 'closer', 'reschedule_approval_threshold', '{"value": null}'::jsonb, 'A partir de qual reagendamento exige aprovação (null = desativado)'),
  (NULL, 'sdr', 'approval_required_roles', '{"roles": ["admin", "coordenador", "manager"]}'::jsonb, 'Quem pode aprovar pedidos do SDR'),
  (NULL, 'closer', 'approval_required_roles', '{"roles": ["admin", "coordenador", "manager"]}'::jsonb, 'Quem pode aprovar pedidos do Closer')
ON CONFLICT DO NOTHING;