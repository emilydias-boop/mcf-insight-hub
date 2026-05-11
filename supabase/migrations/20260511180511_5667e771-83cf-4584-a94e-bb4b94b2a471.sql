
-- 1) Corrige bug: crm_deals.owner_id é TEXT (email). Usar owner_profile_id (uuid) para user_id em deal_activities.
CREATE OR REPLACE FUNCTION public.auto_move_deal_to_em_contato(
  p_deal_id uuid,
  p_source text,
  p_description text DEFAULT NULL::text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_em_contato uuid := 'b1c0a7e2-9d4f-4a1c-8e3b-2f5d6a8b9c01';
  v_allowed uuid[] := ARRAY[
    'e6fab26d-f16d-4b00-900f-ca915cbfe9d9'::uuid,
    'd346320a-00b0-4e9f-89b6-149ad1c34061'::uuid,
    '3c81d73b-0d5d-480f-a3c9-ab7a6c7965a2'::uuid,
    'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b'::uuid,
    'a1d19874-4d47-4405-94fd-fb5237da44dd'::uuid,
    'b06c9413-0312-4f1d-89b4-822d79bc6a90'::uuid
  ];
  v_current uuid;
  v_owner_profile uuid;
BEGIN
  IF p_deal_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT stage_id, owner_profile_id
    INTO v_current, v_owner_profile
  FROM public.crm_deals
  WHERE id = p_deal_id;

  IF v_current IS NULL OR NOT (v_current = ANY(v_allowed)) THEN
    RETURN false;
  END IF;

  UPDATE public.crm_deals
    SET stage_id = v_em_contato, updated_at = now()
    WHERE id = p_deal_id;

  INSERT INTO public.deal_activities (deal_id, activity_type, description, from_stage, to_stage, user_id, metadata)
  VALUES (
    p_deal_id::text,
    'stage_change',
    COALESCE(p_description, format('Movido automaticamente para "Em contato" — contato via %s', p_source)),
    v_current,
    v_em_contato,
    v_owner_profile,
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('source', p_source, 'auto', true)
  );

  RETURN true;
END;
$function$;

-- 2) Trigger em deal_activities — atividades manuais de contato disparam o auto-move.
--    Tipos cobertos: 'call' (registro manual), 'note', 'qualification_note'.
--    NOTA: 'stage_change' é EXCLUÍDO para evitar recursão (a própria RPC insere stage_change).
CREATE OR REPLACE FUNCTION public.auto_move_em_contato_from_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_deal_uuid uuid;
BEGIN
  IF NEW.activity_type NOT IN ('call', 'note', 'qualification_note') THEN
    RETURN NEW;
  END IF;

  IF NEW.metadata ? 'auto' AND (NEW.metadata->>'auto')::boolean = true THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_deal_uuid := NEW.deal_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    -- deal_id pode ser clint_id (não-uuid); resolver via lookup
    SELECT id INTO v_deal_uuid FROM public.crm_deals WHERE clint_id = NEW.deal_id LIMIT 1;
  END;

  IF v_deal_uuid IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.auto_move_deal_to_em_contato(
    v_deal_uuid,
    'manual_activity',
    format('Movido automaticamente para "Em contato" — atividade manual (%s)', NEW.activity_type),
    jsonb_build_object('activity_id', NEW.id, 'activity_type', NEW.activity_type)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[auto_move_em_contato_from_activity] %', SQLERRM;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_auto_move_em_contato_from_activity ON public.deal_activities;
CREATE TRIGGER trg_auto_move_em_contato_from_activity
  AFTER INSERT ON public.deal_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_move_em_contato_from_activity();

-- 3) Trigger em automation_logs — qualquer mensagem enviada (whatsapp/email/sms)
--    com status sent/delivered/read dispara o auto-move.
CREATE OR REPLACE FUNCTION public.auto_move_em_contato_from_automation_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.deal_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status::text NOT IN ('sent', 'delivered', 'read') THEN
    RETURN NEW;
  END IF;

  -- Em UPDATE só dispara quando o status mudou para sent/delivered/read
  IF TG_OP = 'UPDATE' AND OLD.status::text = NEW.status::text THEN
    RETURN NEW;
  END IF;

  PERFORM public.auto_move_deal_to_em_contato(
    NEW.deal_id,
    NEW.channel::text,
    format('Movido automaticamente para "Em contato" — mensagem %s (%s)', NEW.channel::text, NEW.status::text),
    jsonb_build_object(
      'automation_log_id', NEW.id,
      'channel', NEW.channel::text,
      'status', NEW.status::text,
      'recipient', NEW.recipient,
      'external_id', NEW.external_id
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[auto_move_em_contato_from_automation_log] %', SQLERRM;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_auto_move_em_contato_from_automation_log ON public.automation_logs;
CREATE TRIGGER trg_auto_move_em_contato_from_automation_log
  AFTER INSERT OR UPDATE OF status ON public.automation_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_move_em_contato_from_automation_log();
