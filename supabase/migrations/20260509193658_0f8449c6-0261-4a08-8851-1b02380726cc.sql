
-- 1. Função de resolução do dono dinâmico por estágio
CREATE OR REPLACE FUNCTION public.resolve_deal_owner(_deal_id uuid)
RETURNS TABLE(
  profile_id uuid,
  full_name text,
  first_name text,
  email text,
  telefone text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deal record;
  _stage_name text;
  _resolved_email text;
  _raw_phone text;
  _digits text;
BEGIN
  SELECT d.owner_profile_id, d.owner_id, d.original_sdr_email,
         d.r1_closer_email, d.r2_closer_email, d.stage_id
    INTO _deal
  FROM public.crm_deals d
  WHERE d.id = _deal_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT s.name INTO _stage_name
  FROM public.deal_stages s
  WHERE s.id = _deal.stage_id;

  -- Cascata por estágio
  IF _stage_name IN ('R2 Agendada', 'Contrato Pago') AND _deal.r2_closer_email IS NOT NULL THEN
    _resolved_email := lower(_deal.r2_closer_email);
  ELSIF _stage_name IN ('R1 Agendada', 'R1 Realizada', 'No-Show') AND _deal.r1_closer_email IS NOT NULL THEN
    _resolved_email := lower(_deal.r1_closer_email);
  ELSIF _deal.original_sdr_email IS NOT NULL THEN
    _resolved_email := lower(_deal.original_sdr_email);
  END IF;

  -- Buscar profile e telefone
  IF _resolved_email IS NOT NULL THEN
    RETURN QUERY
    SELECT
      p.id,
      p.full_name,
      split_part(coalesce(p.full_name, ''), ' ', 1) AS first_name,
      p.email,
      public.normalize_owner_phone(e.telefone) AS telefone
    FROM public.profiles p
    LEFT JOIN public.employees e ON lower(e.email_pessoal) = lower(p.email)
    WHERE lower(p.email) = _resolved_email
    LIMIT 1;
  ELSIF _deal.owner_profile_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      p.id,
      p.full_name,
      split_part(coalesce(p.full_name, ''), ' ', 1) AS first_name,
      p.email,
      public.normalize_owner_phone(e.telefone) AS telefone
    FROM public.profiles p
    LEFT JOIN public.employees e ON lower(e.email_pessoal) = lower(p.email)
    WHERE p.id = _deal.owner_profile_id
    LIMIT 1;
  END IF;
END;
$$;

-- Helper de normalização para E.164 (BR)
CREATE OR REPLACE FUNCTION public.normalize_owner_phone(_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _digits text;
BEGIN
  IF _raw IS NULL OR length(trim(_raw)) = 0 THEN
    RETURN NULL;
  END IF;
  _digits := regexp_replace(_raw, '\D', '', 'g');
  IF length(_digits) = 0 THEN
    RETURN NULL;
  END IF;
  -- Já inclui código do país (55...)
  IF length(_digits) >= 12 AND left(_digits, 2) = '55' THEN
    RETURN _digits;
  END IF;
  -- 10 ou 11 dígitos: assume BR
  IF length(_digits) BETWEEN 10 AND 11 THEN
    RETURN '55' || _digits;
  END IF;
  RETURN _digits;
END;
$$;

-- 2. Trigger para enfileirar automações na mudança de estágio
CREATE OR REPLACE FUNCTION public.trigger_automation_enqueue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _supabase_url text;
  _service_key text;
BEGIN
  -- Apenas se stage_id mudou (ou inserção com stage_id)
  IF TG_OP = 'UPDATE' AND NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN
    RETURN NEW;
  END IF;

  IF NEW.stage_id IS NULL OR NEW.contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Chamada assíncrona via pg_net
  PERFORM net.http_post(
    url := 'https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/automation-enqueue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'dealId', NEW.id,
      'contactId', NEW.contact_id,
      'newStageId', NEW.stage_id,
      'oldStageId', CASE WHEN TG_OP = 'UPDATE' THEN OLD.stage_id ELSE NULL END,
      'originId', NEW.origin_id,
      'triggerType', 'enter'
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca bloquear o fluxo principal do CRM
  RAISE WARNING '[automation-enqueue trigger] %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_automation_enqueue ON public.crm_deals;
CREATE TRIGGER trg_automation_enqueue
AFTER INSERT OR UPDATE OF stage_id ON public.crm_deals
FOR EACH ROW
EXECUTE FUNCTION public.trigger_automation_enqueue();
