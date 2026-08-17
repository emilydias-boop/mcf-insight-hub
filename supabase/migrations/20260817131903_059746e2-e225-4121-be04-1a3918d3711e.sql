-- 3. Carimbos em consorcio_proposals
ALTER TABLE public.consorcio_proposals
  ADD COLUMN IF NOT EXISTS aceite_at timestamptz,
  ADD COLUMN IF NOT EXISTS aceite_by uuid,
  ADD COLUMN IF NOT EXISTS recusada_at timestamptz,
  ADD COLUMN IF NOT EXISTS recusada_by uuid;

-- 4. Carimbos em consorcio_pending_registrations
ALTER TABLE public.consorcio_pending_registrations
  ADD COLUMN IF NOT EXISTS cadastrada_at timestamptz,
  ADD COLUMN IF NOT EXISTS cadastrada_by uuid,
  ADD COLUMN IF NOT EXISTS cota_aberta_at timestamptz,
  ADD COLUMN IF NOT EXISTS cota_aberta_by uuid,
  ADD COLUMN IF NOT EXISTS vinculada_at timestamptz,
  ADD COLUMN IF NOT EXISTS vinculada_by uuid;

-- Helper: resolve stage name (crm_stages -> local_pipeline_stages -> raw id)
CREATE OR REPLACE FUNCTION public.resolve_stage_name(_stage_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_name text;
BEGIN
  IF _stage_id IS NULL THEN RETURN NULL; END IF;
  SELECT stage_name INTO v_name FROM crm_stages WHERE id = _stage_id;
  IF v_name IS NULL THEN
    SELECT name INTO v_name FROM local_pipeline_stages WHERE id = _stage_id;
  END IF;
  RETURN COALESCE(v_name, _stage_id::text);
EXCEPTION WHEN OTHERS THEN
  RETURN _stage_id::text;
END;
$$;

-- Helper: resolve actor display name from profiles
CREATE OR REPLACE FUNCTION public.resolve_actor_name(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_name text;
BEGIN
  IF _user_id IS NULL THEN RETURN NULL; END IF;
  SELECT full_name INTO v_name FROM profiles WHERE id = _user_id;
  RETURN v_name;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- Helper: resolve owner name from polymorphic text (uuid or email)
CREATE OR REPLACE FUNCTION public.resolve_owner_label(_owner text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_name text;
BEGIN
  IF _owner IS NULL OR btrim(_owner) = '' THEN RETURN NULL; END IF;
  IF _owner ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT full_name INTO v_name FROM profiles WHERE id = _owner::uuid;
  ELSE
    SELECT full_name INTO v_name FROM profiles WHERE lower(email) = lower(_owner);
  END IF;
  RETURN COALESCE(v_name, _owner);
EXCEPTION WHEN OTHERS THEN
  RETURN _owner;
END;
$$;

-- 1. Stage change trigger
CREATE OR REPLACE FUNCTION public.log_deal_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from text;
  v_to text;
  v_actor uuid;
  v_actor_name text;
BEGIN
  BEGIN
    v_actor := auth.uid();
    v_from := public.resolve_stage_name(OLD.stage_id);
    v_to := public.resolve_stage_name(NEW.stage_id);
    v_actor_name := public.resolve_actor_name(v_actor);

    INSERT INTO deal_activities (deal_id, activity_type, description, from_stage, to_stage, user_id, metadata)
    VALUES (
      NEW.id,
      'stage_change',
      'Movido de "' || COALESCE(v_from, 'Estágio anterior') || '" para "' || COALESCE(v_to, 'Novo estágio') || '"',
      v_from,
      v_to,
      v_actor,
      jsonb_build_object(
        'from_stage_id', OLD.stage_id,
        'to_stage_id', NEW.stage_id,
        'moved_at', now(),
        'moved_by_name', v_actor_name,
        'source', 'trigger'
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_deal_stage_change ON public.crm_deals;
CREATE TRIGGER trg_log_deal_stage_change
AFTER UPDATE OF stage_id ON public.crm_deals
FOR EACH ROW
WHEN (OLD.stage_id IS DISTINCT FROM NEW.stage_id)
EXECUTE FUNCTION public.log_deal_stage_change();

-- 2. Owner change trigger
CREATE OR REPLACE FUNCTION public.log_deal_owner_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_actor_name text;
  v_changed text[] := ARRAY[]::text[];
  v_prev text;
  v_new text;
BEGIN
  BEGIN
    v_actor := auth.uid();
    v_actor_name := public.resolve_actor_name(v_actor);

    IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN v_changed := v_changed || 'owner_id'; END IF;
    IF OLD.owner_profile_id IS DISTINCT FROM NEW.owner_profile_id THEN v_changed := v_changed || 'owner_profile_id'; END IF;
    IF OLD.r1_closer_email IS DISTINCT FROM NEW.r1_closer_email THEN v_changed := v_changed || 'r1_closer_email'; END IF;
    IF OLD.r2_closer_email IS DISTINCT FROM NEW.r2_closer_email THEN v_changed := v_changed || 'r2_closer_email'; END IF;

    IF array_length(v_changed, 1) IS NULL THEN RETURN NULL; END IF;

    v_prev := COALESCE(public.resolve_owner_label(OLD.owner_id), public.resolve_actor_name(OLD.owner_profile_id));
    v_new := COALESCE(public.resolve_owner_label(NEW.owner_id), public.resolve_actor_name(NEW.owner_profile_id));

    INSERT INTO deal_activities (deal_id, activity_type, description, user_id, metadata)
    VALUES (
      NEW.id,
      'owner_change',
      'Responsável alterado de "' || COALESCE(v_prev, 'sem responsável') || '" para "' || COALESCE(v_new, 'sem responsável') || '"',
      v_actor,
      jsonb_build_object(
        'previous_owner', OLD.owner_id,
        'new_owner', NEW.owner_id,
        'new_owner_name', v_new,
        'previous_owner_name', v_prev,
        'transferred_by', v_actor,
        'transferred_by_name', v_actor_name,
        'previous_owner_profile_id', OLD.owner_profile_id,
        'new_owner_profile_id', NEW.owner_profile_id,
        'previous_r1_closer_email', OLD.r1_closer_email,
        'new_r1_closer_email', NEW.r1_closer_email,
        'previous_r2_closer_email', OLD.r2_closer_email,
        'new_r2_closer_email', NEW.r2_closer_email,
        'changed_fields', to_jsonb(v_changed),
        'changed_at', now(),
        'source', 'trigger'
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_deal_owner_change ON public.crm_deals;
CREATE TRIGGER trg_log_deal_owner_change
AFTER UPDATE OF owner_id, owner_profile_id, r1_closer_email, r2_closer_email ON public.crm_deals
FOR EACH ROW
EXECUTE FUNCTION public.log_deal_owner_change();

-- 5. Generic audit trigger reusing public.audit_logs
CREATE OR REPLACE FUNCTION public.log_generic_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (
      auth.uid(),
      TG_OP,
      TG_TABLE_NAME,
      COALESCE(NEW.id, OLD.id),
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
      CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_consorcio_proposals ON public.consorcio_proposals;
CREATE TRIGGER trg_audit_consorcio_proposals
AFTER INSERT OR UPDATE OR DELETE ON public.consorcio_proposals
FOR EACH ROW EXECUTE FUNCTION public.log_generic_audit();

DROP TRIGGER IF EXISTS trg_audit_consorcio_pending_registrations ON public.consorcio_pending_registrations;
CREATE TRIGGER trg_audit_consorcio_pending_registrations
AFTER INSERT OR UPDATE OR DELETE ON public.consorcio_pending_registrations
FOR EACH ROW EXECUTE FUNCTION public.log_generic_audit();