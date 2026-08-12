CREATE TABLE public.sonax_call_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento text NOT NULL,
  id_chamada text,
  id_chamada_originador text,
  ramal text,
  aliasramal text,
  numero text,
  numero_rec text,
  data_inicio text,
  data_fim text,
  status_chamada text,
  status_atendimento text,
  duracao_chamada text,
  url_gravacao text,
  sdr_email text,
  sdr_name text,
  contact_id uuid,
  deal_id text,
  deal_activity_id uuid,
  match_error text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sonax_call_events TO authenticated;
GRANT ALL ON public.sonax_call_events TO service_role;

ALTER TABLE public.sonax_call_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can view sonax call events"
ON public.sonax_call_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE INDEX idx_sonax_call_events_created_at ON public.sonax_call_events (created_at DESC);
CREATE INDEX idx_sonax_call_events_ramal ON public.sonax_call_events (ramal);
CREATE INDEX idx_sonax_call_events_id_chamada ON public.sonax_call_events (id_chamada);

CREATE OR REPLACE FUNCTION public.sonax_match_lead_by_phone(p_phone text)
RETURNS TABLE (contact_id uuid, deal_id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH suffix AS (
    SELECT right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 9) AS s
  )
  SELECT c.id,
         (SELECT d.id FROM public.crm_deals d
           WHERE d.contact_id = c.id
           ORDER BY d.created_at DESC NULLS LAST
           LIMIT 1)
  FROM public.crm_contacts c, suffix
  WHERE length(suffix.s) = 9
    AND right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 9) = suffix.s
  ORDER BY c.created_at DESC NULLS LAST
  LIMIT 1;
$$;