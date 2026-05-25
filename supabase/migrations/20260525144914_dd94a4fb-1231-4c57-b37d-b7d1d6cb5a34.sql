
-- ============ ENUMs ============
DO $$ BEGIN
  CREATE TYPE public.card_activity_category AS ENUM ('parcela','boleto','documento','carta','sistema');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.card_activity_event AS ENUM (
    'installment_paid','installment_reverted','installment_value_changed',
    'installment_due_changed','installment_form_changed','installment_created',
    'installment_deleted','installment_recalculated',
    'boleto_uploaded','boleto_replaced','boleto_deleted','boleto_sent',
    'document_uploaded','document_deleted',
    'card_created','card_field_changed','card_status_changed','card_deleted'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ TABLE ============
CREATE TABLE IF NOT EXISTS public.consortium_card_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.consortium_cards(id) ON DELETE CASCADE,
  subscription_id uuid,
  installment_id uuid,
  boleto_id uuid,
  document_id uuid,
  event_category public.card_activity_category NOT NULL,
  event_type public.card_activity_event NOT NULL,
  description text NOT NULL,
  before_value jsonb,
  after_value jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ccal_card_id_created ON public.consortium_card_activity_log(card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ccal_event_type ON public.consortium_card_activity_log(event_type);
CREATE INDEX IF NOT EXISTS idx_ccal_subscription ON public.consortium_card_activity_log(subscription_id);

ALTER TABLE public.consortium_card_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read activity log" ON public.consortium_card_activity_log;
CREATE POLICY "Authenticated read activity log"
ON public.consortium_card_activity_log
FOR SELECT TO authenticated USING (true);

-- ============ HELPERS ============
CREATE OR REPLACE FUNCTION public._actor_name(_uid uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(full_name, email, 'Sistema') FROM public.profiles WHERE id = _uid LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.log_card_event(
  _card_id uuid,
  _category public.card_activity_category,
  _event public.card_activity_event,
  _description text,
  _before jsonb DEFAULT NULL,
  _after jsonb DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _subscription_id uuid DEFAULT NULL,
  _installment_id uuid DEFAULT NULL,
  _boleto_id uuid DEFAULT NULL,
  _document_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _name text := public._actor_name(auth.uid());
  _id uuid;
BEGIN
  IF _card_id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.consortium_card_activity_log(
    card_id, subscription_id, installment_id, boleto_id, document_id,
    event_category, event_type, description, before_value, after_value, metadata,
    actor_id, actor_name
  ) VALUES (
    _card_id, _subscription_id, _installment_id, _boleto_id, _document_id,
    _category, _event, _description, _before, _after, COALESCE(_metadata,'{}'::jsonb),
    _uid, COALESCE(_name,'Sistema')
  ) RETURNING id INTO _id;
  RETURN _id;
END $$;

GRANT EXECUTE ON FUNCTION public.log_card_event(uuid,public.card_activity_category,public.card_activity_event,text,jsonb,jsonb,jsonb,uuid,uuid,uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public._card_id_for_subscription(_sub uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id
  FROM public.billing_subscriptions s
  JOIN public.consortium_cards c
    ON upper(trim(c.nome_completo)) = upper(trim(s.customer_name))
  WHERE s.id = _sub
  ORDER BY c.created_at DESC
  LIMIT 1
$$;

-- ============ TRIGGER: billing_installments ============
CREATE OR REPLACE FUNCTION public._tg_log_installment_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _card uuid;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    _card := public._card_id_for_subscription(NEW.subscription_id);
    IF _card IS NULL THEN RETURN NEW; END IF;
    PERFORM public.log_card_event(
      _card, 'parcela'::public.card_activity_category, 'installment_created'::public.card_activity_event,
      'Parcela ' || NEW.numero_parcela || ' criada (R$ ' || to_char(NEW.valor_original,'FM999G999G990D00') || ')',
      NULL, to_jsonb(NEW), '{}'::jsonb, NEW.subscription_id, NEW.id, NULL, NULL
    );
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    _card := public._card_id_for_subscription(OLD.subscription_id);
    IF _card IS NULL THEN RETURN OLD; END IF;
    PERFORM public.log_card_event(
      _card, 'parcela', 'installment_deleted',
      'Parcela ' || OLD.numero_parcela || ' excluída',
      to_jsonb(OLD), NULL, '{}'::jsonb, OLD.subscription_id, OLD.id, NULL, NULL
    );
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    _card := public._card_id_for_subscription(NEW.subscription_id);
    IF _card IS NULL THEN RETURN NEW; END IF;

    IF (OLD.status::text <> 'pago' AND NEW.status::text = 'pago') THEN
      PERFORM public.log_card_event(
        _card, 'parcela', 'installment_paid',
        'Parcela ' || NEW.numero_parcela || ' marcada como paga' ||
          CASE WHEN NEW.forma_pagamento IS NOT NULL THEN ' via ' || NEW.forma_pagamento::text ELSE '' END ||
          ' (R$ ' || to_char(COALESCE(NEW.valor_pago,NEW.valor_original),'FM999G999G990D00') || ')',
        to_jsonb(OLD), to_jsonb(NEW), '{}'::jsonb, NEW.subscription_id, NEW.id, NULL, NULL
      );
    ELSIF (OLD.status::text = 'pago' AND NEW.status::text <> 'pago') THEN
      PERFORM public.log_card_event(
        _card, 'parcela', 'installment_reverted',
        'Pagamento da parcela ' || NEW.numero_parcela || ' revertido',
        to_jsonb(OLD), to_jsonb(NEW), '{}'::jsonb, NEW.subscription_id, NEW.id, NULL, NULL
      );
    END IF;

    IF (COALESCE(OLD.valor_original,0) <> COALESCE(NEW.valor_original,0)) THEN
      PERFORM public.log_card_event(
        _card, 'parcela', 'installment_value_changed',
        'Valor da parcela ' || NEW.numero_parcela || ' alterado de R$ ' ||
          to_char(OLD.valor_original,'FM999G999G990D00') || ' para R$ ' || to_char(NEW.valor_original,'FM999G999G990D00'),
        jsonb_build_object('valor_original', OLD.valor_original),
        jsonb_build_object('valor_original', NEW.valor_original),
        '{}'::jsonb, NEW.subscription_id, NEW.id, NULL, NULL
      );
    END IF;

    IF (OLD.data_vencimento IS DISTINCT FROM NEW.data_vencimento) THEN
      PERFORM public.log_card_event(
        _card, 'parcela', 'installment_due_changed',
        'Vencimento da parcela ' || NEW.numero_parcela || ' alterado de ' ||
          to_char(OLD.data_vencimento,'DD/MM/YYYY') || ' para ' || to_char(NEW.data_vencimento,'DD/MM/YYYY'),
        jsonb_build_object('data_vencimento', OLD.data_vencimento),
        jsonb_build_object('data_vencimento', NEW.data_vencimento),
        '{}'::jsonb, NEW.subscription_id, NEW.id, NULL, NULL
      );
    END IF;

    IF (OLD.forma_pagamento IS DISTINCT FROM NEW.forma_pagamento) THEN
      PERFORM public.log_card_event(
        _card, 'parcela', 'installment_form_changed',
        'Forma de pagamento da parcela ' || NEW.numero_parcela || ' alterada para ' || COALESCE(NEW.forma_pagamento::text,'-'),
        jsonb_build_object('forma_pagamento', OLD.forma_pagamento),
        jsonb_build_object('forma_pagamento', NEW.forma_pagamento),
        '{}'::jsonb, NEW.subscription_id, NEW.id, NULL, NULL
      );
    END IF;

    RETURN NEW;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS tg_log_installment_activity ON public.billing_installments;
CREATE TRIGGER tg_log_installment_activity
AFTER INSERT OR UPDATE OR DELETE ON public.billing_installments
FOR EACH ROW EXECUTE FUNCTION public._tg_log_installment_activity();

-- ============ TRIGGER: consorcio_boletos ============
CREATE OR REPLACE FUNCTION public._tg_log_boleto_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT') AND NEW.card_id IS NOT NULL THEN
    PERFORM public.log_card_event(
      NEW.card_id, 'boleto', 'boleto_uploaded',
      'Boleto enviado' ||
        CASE WHEN NEW.vencimento_extraido IS NOT NULL
             THEN ' (venc. ' || to_char(NEW.vencimento_extraido,'DD/MM/YYYY') || ')'
             ELSE '' END,
      NULL, to_jsonb(NEW), jsonb_build_object('storage_path', NEW.storage_path),
      NULL, NEW.installment_id, NEW.id, NULL
    );
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') AND NEW.card_id IS NOT NULL THEN
    IF (OLD.storage_path IS DISTINCT FROM NEW.storage_path) THEN
      PERFORM public.log_card_event(
        NEW.card_id, 'boleto', 'boleto_replaced',
        'Arquivo do boleto substituído',
        to_jsonb(OLD), to_jsonb(NEW), '{}'::jsonb, NULL, NEW.installment_id, NEW.id, NULL
      );
    END IF;
    IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status = 'sent' THEN
      PERFORM public.log_card_event(
        NEW.card_id, 'boleto', 'boleto_sent',
        'Boleto enviado ao cliente',
        to_jsonb(OLD), to_jsonb(NEW), '{}'::jsonb, NULL, NEW.installment_id, NEW.id, NULL
      );
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') AND OLD.card_id IS NOT NULL THEN
    PERFORM public.log_card_event(
      OLD.card_id, 'boleto', 'boleto_deleted',
      'Boleto excluído',
      to_jsonb(OLD), NULL, '{}'::jsonb, NULL, OLD.installment_id, OLD.id, NULL
    );
    RETURN OLD;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS tg_log_boleto_activity ON public.consorcio_boletos;
CREATE TRIGGER tg_log_boleto_activity
AFTER INSERT OR UPDATE OR DELETE ON public.consorcio_boletos
FOR EACH ROW EXECUTE FUNCTION public._tg_log_boleto_activity();

-- ============ TRIGGER: consortium_documents ============
CREATE OR REPLACE FUNCTION public._tg_log_document_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT') AND NEW.card_id IS NOT NULL THEN
    PERFORM public.log_card_event(
      NEW.card_id, 'documento', 'document_uploaded',
      'Documento "' || COALESCE(NEW.nome_arquivo,'sem nome') || '" anexado' ||
        CASE WHEN NEW.tipo IS NOT NULL THEN ' (' || NEW.tipo || ')' ELSE '' END,
      NULL, to_jsonb(NEW), '{}'::jsonb, NULL, NULL, NULL, NEW.id
    );
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') AND OLD.card_id IS NOT NULL THEN
    PERFORM public.log_card_event(
      OLD.card_id, 'documento', 'document_deleted',
      'Documento "' || COALESCE(OLD.nome_arquivo,'sem nome') || '" removido',
      to_jsonb(OLD), NULL, '{}'::jsonb, NULL, NULL, NULL, OLD.id
    );
    RETURN OLD;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS tg_log_document_activity ON public.consortium_documents;
CREATE TRIGGER tg_log_document_activity
AFTER INSERT OR DELETE ON public.consortium_documents
FOR EACH ROW EXECUTE FUNCTION public._tg_log_document_activity();

-- ============ TRIGGER: consortium_cards ============
CREATE OR REPLACE FUNCTION public._tg_log_card_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _field text;
  _tracked text[] := ARRAY[
    'status','grupo','cota','valor_credito','prazo_meses','tipo_produto','tipo_contrato',
    'dia_vencimento','vendedor_name','vendedor_id','categoria','origem','origem_detalhe',
    'nome_completo','cpf','telefone','email','observacoes','data_contratacao',
    'numero_contemplacao','data_contemplacao','valor_lance','valor_comissao',
    'parcela_1a_12a','parcela_demais','condicao_pagamento'
  ];
  _old jsonb;
  _new jsonb;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM public.log_card_event(
      NEW.id, 'carta', 'card_created',
      'Carta criada' ||
        CASE WHEN NEW.nome_completo IS NOT NULL THEN ' para ' || NEW.nome_completo ELSE '' END,
      NULL, to_jsonb(NEW), '{}'::jsonb, NULL, NULL, NULL, NULL
    );
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    _old := to_jsonb(OLD);
    _new := to_jsonb(NEW);
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
      PERFORM public.log_card_event(
        NEW.id, 'carta', 'card_status_changed',
        'Status alterado de "' || COALESCE(OLD.status,'-') || '" para "' || COALESCE(NEW.status,'-') || '"',
        jsonb_build_object('status', OLD.status),
        jsonb_build_object('status', NEW.status),
        '{}'::jsonb, NULL, NULL, NULL, NULL
      );
    END IF;
    FOREACH _field IN ARRAY _tracked LOOP
      IF _field = 'status' THEN CONTINUE; END IF;
      IF (_old -> _field) IS DISTINCT FROM (_new -> _field) THEN
        PERFORM public.log_card_event(
          NEW.id, 'carta', 'card_field_changed',
          'Campo "' || _field || '" alterado',
          jsonb_build_object(_field, _old -> _field),
          jsonb_build_object(_field, _new -> _field),
          jsonb_build_object('field', _field),
          NULL, NULL, NULL, NULL
        );
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS tg_log_card_activity ON public.consortium_cards;
CREATE TRIGGER tg_log_card_activity
AFTER INSERT OR UPDATE ON public.consortium_cards
FOR EACH ROW EXECUTE FUNCTION public._tg_log_card_activity();

-- ============ BACKFILL ============
INSERT INTO public.consortium_card_activity_log(card_id, event_category, event_type, description, after_value, metadata, actor_name, created_at)
SELECT c.id, 'carta', 'card_created',
  'Carta criada' || CASE WHEN c.nome_completo IS NOT NULL THEN ' para ' || c.nome_completo ELSE '' END,
  to_jsonb(c), jsonb_build_object('backfill', true), 'Sistema (histórico)', c.created_at
FROM public.consortium_cards c;

INSERT INTO public.consortium_card_activity_log(card_id, subscription_id, installment_id, event_category, event_type, description, after_value, metadata, actor_name, created_at)
SELECT
  public._card_id_for_subscription(i.subscription_id),
  i.subscription_id, i.id, 'parcela', 'installment_paid',
  'Parcela ' || i.numero_parcela || ' marcada como paga' ||
    CASE WHEN i.forma_pagamento IS NOT NULL THEN ' via ' || i.forma_pagamento::text ELSE '' END ||
    ' (R$ ' || to_char(COALESCE(i.valor_pago,i.valor_original),'FM999G999G990D00') || ')',
  to_jsonb(i), jsonb_build_object('backfill', true),
  'Sistema (histórico)', COALESCE(i.data_pagamento::timestamptz, i.updated_at, i.created_at)
FROM public.billing_installments i
WHERE i.status::text = 'pago'
  AND public._card_id_for_subscription(i.subscription_id) IS NOT NULL;

INSERT INTO public.consortium_card_activity_log(card_id, installment_id, boleto_id, event_category, event_type, description, after_value, metadata, actor_id, actor_name, created_at)
SELECT b.card_id, b.installment_id, b.id, 'boleto', 'boleto_uploaded',
  'Boleto enviado' ||
    CASE WHEN b.vencimento_extraido IS NOT NULL
         THEN ' (venc. ' || to_char(b.vencimento_extraido,'DD/MM/YYYY') || ')'
         ELSE '' END,
  to_jsonb(b), jsonb_build_object('backfill', true),
  b.uploaded_by, COALESCE(public._actor_name(b.uploaded_by),'Sistema (histórico)'), b.created_at
FROM public.consorcio_boletos b
WHERE b.card_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.consortium_cards c WHERE c.id = b.card_id);

INSERT INTO public.consortium_card_activity_log(card_id, document_id, event_category, event_type, description, after_value, metadata, actor_id, actor_name, created_at)
SELECT d.card_id, d.id, 'documento', 'document_uploaded',
  'Documento "' || COALESCE(d.nome_arquivo,'sem nome') || '" anexado' ||
    CASE WHEN d.tipo IS NOT NULL THEN ' (' || d.tipo || ')' ELSE '' END,
  to_jsonb(d), jsonb_build_object('backfill', true),
  d.uploaded_by, COALESCE(public._actor_name(d.uploaded_by),'Sistema (histórico)'), d.uploaded_at
FROM public.consortium_documents d
WHERE d.card_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.consortium_cards c WHERE c.id = d.card_id);
