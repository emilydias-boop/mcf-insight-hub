
CREATE TABLE public.outbound_webhook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'POST',
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  events TEXT[] NOT NULL DEFAULT ARRAY['sale.created']::text[],
  sources TEXT[] NOT NULL DEFAULT ARRAY['hubla','kiwify','mcfpay','make','asaas','manual']::text[],
  product_categories TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  secret_token TEXT,
  success_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE TABLE public.outbound_webhook_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES public.outbound_webhook_configs(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  transaction_id UUID,
  payload JSONB NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  response_status INTEGER,
  response_body TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX idx_outbound_queue_pending ON public.outbound_webhook_queue (status, next_retry_at) WHERE status IN ('pending','processing');
CREATE INDEX idx_outbound_queue_config ON public.outbound_webhook_queue (config_id, created_at DESC);

CREATE TABLE public.outbound_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES public.outbound_webhook_configs(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  transaction_id UUID,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  duration_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_outbound_logs_config ON public.outbound_webhook_logs (config_id, created_at DESC);

ALTER TABLE public.outbound_webhook_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_webhook_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage outbound configs"
  ON public.outbound_webhook_configs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin view outbound queue"
  ON public.outbound_webhook_queue FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin view outbound logs"
  ON public.outbound_webhook_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.build_sale_webhook_payload(_tx public.hubla_transactions, _event TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cpf_value TEXT;
  is_recurring BOOLEAN;
BEGIN
  cpf_value := COALESCE(
    _tx.raw_data #>> '{customer,document}',
    _tx.raw_data #>> '{customer,cpf}',
    _tx.raw_data #>> '{user,document}',
    _tx.raw_data #>> '{buyer,document}',
    _tx.raw_data #>> '{data,customer,document}',
    _tx.raw_data #>> '{customer,documentNumber}'
  );

  is_recurring := COALESCE(_tx.installment_number, 1) > 1
                  OR COALESCE(_tx.total_installments, 1) > 1;

  RETURN jsonb_build_object(
    'event', _event,
    'occurred_at', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"'),
    'transaction_id', _tx.id,
    'source', _tx.source,
    'external_id', _tx.hubla_id,
    'product', jsonb_build_object(
      'name', _tx.product_name,
      'category', _tx.product_category,
      'code', _tx.product_code,
      'type', _tx.product_type,
      'offer_name', _tx.offer_name,
      'offer_id', _tx.offer_id
    ),
    'values', jsonb_build_object(
      'gross_system', _tx.product_price,
      'gross_product', _tx.product_price,
      'gross_override', _tx.gross_override,
      'net', _tx.net_value,
      'currency', 'BRL'
    ),
    'payment', jsonb_build_object(
      'method', _tx.payment_method,
      'installment_number', COALESCE(_tx.installment_number, 1),
      'total_installments', COALESCE(_tx.total_installments, 1),
      'is_recurring', is_recurring,
      'is_first_installment', COALESCE(_tx.installment_number, 1) = 1
    ),
    'customer', jsonb_build_object(
      'name', _tx.customer_name,
      'email', _tx.customer_email,
      'phone', _tx.customer_phone,
      'cpf', cpf_value
    ),
    'sale_date', _tx.sale_date,
    'sale_status', _tx.sale_status,
    'sale_origin', _tx.sale_origin,
    'utm', jsonb_build_object(
      'source', _tx.utm_source,
      'medium', _tx.utm_medium,
      'campaign', _tx.utm_campaign,
      'content', _tx.utm_content
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_outbound_sale_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg RECORD;
  evt TEXT;
  is_sale_status BOOLEAN;
  was_sale_status BOOLEAN;
  is_refund_status BOOLEAN;
  payload JSONB;
BEGIN
  is_sale_status := NEW.sale_status IN ('paid','approved','completed','active');
  is_refund_status := NEW.sale_status IN ('refunded','chargeback');

  IF TG_OP = 'INSERT' THEN
    IF NOT is_sale_status THEN
      RETURN NEW;
    END IF;
    evt := 'sale.created';
  ELSIF TG_OP = 'UPDATE' THEN
    was_sale_status := OLD.sale_status IN ('paid','approved','completed','active');

    IF was_sale_status AND is_refund_status THEN
      evt := 'sale.refunded';
    ELSIF is_sale_status AND (
      NEW.net_value IS DISTINCT FROM OLD.net_value
      OR NEW.product_price IS DISTINCT FROM OLD.product_price
      OR NEW.sale_status IS DISTINCT FROM OLD.sale_status
      OR NEW.gross_override IS DISTINCT FROM OLD.gross_override
    ) THEN
      evt := 'sale.updated';
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  IF NEW.source IS NULL OR NEW.source NOT IN ('hubla','kiwify','mcfpay','make','asaas','manual') THEN
    RETURN NEW;
  END IF;

  payload := public.build_sale_webhook_payload(NEW, evt);

  FOR cfg IN
    SELECT * FROM public.outbound_webhook_configs
    WHERE is_active = true
      AND evt = ANY(events)
      AND NEW.source = ANY(sources)
      AND (product_categories IS NULL OR array_length(product_categories,1) IS NULL OR NEW.product_category = ANY(product_categories))
  LOOP
    INSERT INTO public.outbound_webhook_queue (config_id, event, transaction_id, payload)
    VALUES (cfg.id, evt, NEW.id, payload);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_outbound_sale_webhook ON public.hubla_transactions;
CREATE TRIGGER trg_outbound_sale_webhook
  AFTER INSERT OR UPDATE ON public.hubla_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_outbound_sale_webhook();

CREATE TRIGGER outbound_webhook_configs_updated_at
  BEFORE UPDATE ON public.outbound_webhook_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
