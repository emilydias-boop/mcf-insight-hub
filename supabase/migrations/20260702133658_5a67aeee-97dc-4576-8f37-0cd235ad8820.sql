
-- 1) Enriquecer build_sale_webhook_payload com dados de Closer/SDR/attendee/deal
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
  att RECORD;
  slot RECORD;
  closer_profile RECORD;
  sdr_profile RECORD;
  attribution JSONB := 'null'::jsonb;
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

  -- Se a transação está vinculada a um attendee, buscar dados de Closer/SDR
  IF _tx.linked_attendee_id IS NOT NULL THEN
    SELECT id, meeting_slot_id, deal_id, contact_id, booked_by, attendee_name, contract_paid_at
      INTO att
      FROM public.meeting_slot_attendees
     WHERE id = _tx.linked_attendee_id;

    IF FOUND THEN
      SELECT id, closer_id, scheduled_at
        INTO slot
        FROM public.meeting_slots
       WHERE id = att.meeting_slot_id;

      IF slot.closer_id IS NOT NULL THEN
        SELECT id, full_name, email
          INTO closer_profile
          FROM public.profiles
         WHERE id = slot.closer_id;
      END IF;

      IF att.booked_by IS NOT NULL THEN
        SELECT id, full_name, email
          INTO sdr_profile
          FROM public.profiles
         WHERE id = att.booked_by;
      END IF;

      attribution := jsonb_build_object(
        'attendee_id', att.id,
        'deal_id', att.deal_id,
        'contact_id', att.contact_id,
        'meeting_slot_id', att.meeting_slot_id,
        'meeting_scheduled_at', slot.scheduled_at,
        'contract_paid_at', att.contract_paid_at,
        'closer', CASE
          WHEN closer_profile.id IS NOT NULL THEN jsonb_build_object(
            'id', closer_profile.id,
            'name', closer_profile.full_name,
            'email', closer_profile.email
          )
          ELSE NULL
        END,
        'sdr', CASE
          WHEN sdr_profile.id IS NOT NULL THEN jsonb_build_object(
            'id', sdr_profile.id,
            'name', sdr_profile.full_name,
            'email', sdr_profile.email
          )
          ELSE NULL
        END
      );
    END IF;
  END IF;

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
    ),
    'attribution', attribution
  );
END;
$$;

-- 2) Trigger para enfileirar sale.linked quando linked_attendee_id muda
CREATE OR REPLACE FUNCTION public.enqueue_outbound_sale_linked_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg RECORD;
  payload JSONB;
BEGIN
  -- Só dispara quando linked_attendee_id passa de NULL/outro valor para um novo valor não-nulo
  IF NEW.linked_attendee_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.linked_attendee_id IS NOT DISTINCT FROM NEW.linked_attendee_id THEN
    RETURN NEW;
  END IF;

  -- Fonte precisa ser conhecida
  IF NEW.source IS NULL OR NEW.source NOT IN ('hubla','kiwify','mcfpay','make','asaas','manual') THEN
    RETURN NEW;
  END IF;

  payload := public.build_sale_webhook_payload(NEW, 'sale.linked');

  FOR cfg IN
    SELECT * FROM public.outbound_webhook_configs
    WHERE is_active = true
      AND 'sale.linked' = ANY(events)
      AND NEW.source = ANY(sources)
      AND (product_categories IS NULL OR array_length(product_categories,1) IS NULL OR NEW.product_category = ANY(product_categories))
  LOOP
    INSERT INTO public.outbound_webhook_queue (config_id, event, transaction_id, payload)
    VALUES (cfg.id, 'sale.linked', NEW.id, payload);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_outbound_sale_linked_webhook ON public.hubla_transactions;
CREATE TRIGGER trg_outbound_sale_linked_webhook
  AFTER INSERT OR UPDATE OF linked_attendee_id ON public.hubla_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_outbound_sale_linked_webhook();
