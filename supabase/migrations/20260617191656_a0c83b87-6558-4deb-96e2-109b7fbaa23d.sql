
CREATE TABLE IF NOT EXISTS public.webhook_ingest_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('kiwify','hubla','clint','backfill','manual')),
  hubla_id text,
  customer_email text,
  customer_phone text,
  customer_name text,
  product_name text,
  raw_payload jsonb NOT NULL,
  failure_reason text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','retrying','resolved','abandoned')),
  resolved_at timestamptz,
  resolved_deal_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wif_status_attempts ON public.webhook_ingest_failures(status, attempts) WHERE status IN ('pending','retrying');
CREATE INDEX IF NOT EXISTS idx_wif_hubla_id ON public.webhook_ingest_failures(hubla_id);
CREATE INDEX IF NOT EXISTS idx_wif_created_at ON public.webhook_ingest_failures(created_at DESC);

GRANT SELECT ON public.webhook_ingest_failures TO authenticated;
GRANT ALL ON public.webhook_ingest_failures TO service_role;
ALTER TABLE public.webhook_ingest_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view ingest failures"
  ON public.webhook_ingest_failures FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'coordenador')
  );

CREATE OR REPLACE FUNCTION public.update_wif_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_wif_updated_at ON public.webhook_ingest_failures;
CREATE TRIGGER trg_wif_updated_at BEFORE UPDATE ON public.webhook_ingest_failures
  FOR EACH ROW EXECUTE FUNCTION public.update_wif_updated_at();

CREATE OR REPLACE VIEW public.v_a010_reconciliation AS
SELECT
  (ht.sale_date AT TIME ZONE 'America/Sao_Paulo')::date as day,
  ht.source,
  count(*) as transactions,
  count(ht.linked_deal_id) as transactions_with_deal,
  count(*) FILTER (WHERE ht.linked_deal_id IS NULL) as transactions_orphan
FROM public.hubla_transactions ht
WHERE ht.sale_status = 'completed'
  AND (ht.product_name ILIKE 'A010%' OR ht.product_code = '1475bb20-12e7-11ef-9e36-f58d9f9c7ab9')
  AND ht.hubla_id NOT LIKE 'newsale-%'
GROUP BY 1, 2;

GRANT SELECT ON public.v_a010_reconciliation TO authenticated;
