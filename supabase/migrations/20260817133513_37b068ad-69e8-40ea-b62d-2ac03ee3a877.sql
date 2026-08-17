-- 1. resolve_actor_name: COALESCE(full_name, email)
CREATE OR REPLACE FUNCTION public.resolve_actor_name(_user_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_name text;
BEGIN
  IF _user_id IS NULL THEN RETURN NULL; END IF;
  SELECT COALESCE(NULLIF(TRIM(full_name), ''), email) INTO v_name FROM profiles WHERE id = _user_id;
  RETURN v_name;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.resolve_actor_email(_user_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_email text;
BEGIN
  IF _user_id IS NULL THEN RETURN NULL; END IF;
  SELECT email INTO v_email FROM profiles WHERE id = _user_id;
  RETURN v_email;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END; $$;

-- 2. stage_change: omite user_id quando auth.uid() é nulo + moved_by_email
CREATE OR REPLACE FUNCTION public.log_deal_stage_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_from text; v_to text; v_actor uuid; v_actor_name text; v_actor_email text; v_meta jsonb; v_desc text;
BEGIN
  BEGIN
    v_actor := auth.uid();
    v_from := public.resolve_stage_name(OLD.stage_id);
    v_to := public.resolve_stage_name(NEW.stage_id);
    v_actor_name := public.resolve_actor_name(v_actor);
    v_actor_email := public.resolve_actor_email(v_actor);
    v_desc := 'Movido de "' || COALESCE(v_from, 'Estágio anterior') || '" para "' || COALESCE(v_to, 'Novo estágio') || '"';
    v_meta := jsonb_build_object(
      'from_stage_id', OLD.stage_id,
      'to_stage_id', NEW.stage_id,
      'moved_at', now(),
      'moved_by_name', v_actor_name,
      'moved_by_email', v_actor_email,
      'source', 'trigger',
      'actor_missing', (v_actor IS NULL)
    );

    IF v_actor IS NULL THEN
      -- NULL explícito suprimiria eventual DEFAULT da coluna: omitimos user_id
      INSERT INTO deal_activities (deal_id, activity_type, description, from_stage, to_stage, metadata)
      VALUES (NEW.id, 'stage_change', v_desc, v_from, v_to, v_meta);
    ELSE
      INSERT INTO deal_activities (deal_id, activity_type, description, from_stage, to_stage, user_id, metadata)
      VALUES (NEW.id, 'stage_change', v_desc, v_from, v_to, v_actor, v_meta);
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NULL;
END; $$;

-- 3. owner_change: só quando owner_id/owner_profile_id mudam de fato
CREATE OR REPLACE FUNCTION public.log_deal_owner_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_actor uuid; v_actor_name text; v_actor_email text;
  v_changed text[] := ARRAY[]::text[]; v_prev text; v_new text; v_meta jsonb; v_desc text;
BEGIN
  BEGIN
    IF OLD.owner_id IS NOT DISTINCT FROM NEW.owner_id
       AND OLD.owner_profile_id IS NOT DISTINCT FROM NEW.owner_profile_id THEN
      RETURN NULL;
    END IF;

    v_actor := auth.uid();
    v_actor_name := public.resolve_actor_name(v_actor);
    v_actor_email := public.resolve_actor_email(v_actor);

    IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN v_changed := v_changed || 'owner_id'; END IF;
    IF OLD.owner_profile_id IS DISTINCT FROM NEW.owner_profile_id THEN v_changed := v_changed || 'owner_profile_id'; END IF;

    v_prev := COALESCE(public.resolve_owner_label(OLD.owner_id), public.resolve_actor_name(OLD.owner_profile_id));
    v_new := COALESCE(public.resolve_owner_label(NEW.owner_id), public.resolve_actor_name(NEW.owner_profile_id));
    v_desc := 'Responsável alterado de "' || COALESCE(v_prev, 'sem responsável') || '" para "' || COALESCE(v_new, 'sem responsável') || '"';

    v_meta := jsonb_build_object(
      'previous_owner', OLD.owner_id,
      'new_owner', NEW.owner_id,
      'new_owner_name', v_new,
      'previous_owner_name', v_prev,
      'transferred_by', COALESCE(v_actor_name, v_actor_email),
      'transferred_by_id', v_actor,
      'transferred_by_name', v_actor_name,
      'moved_by_name', v_actor_name,
      'moved_by_email', v_actor_email,
      'previous_owner_profile_id', OLD.owner_profile_id,
      'new_owner_profile_id', NEW.owner_profile_id,
      'changed_fields', to_jsonb(v_changed),
      'changed_at', now(),
      'source', 'trigger',
      'actor_missing', (v_actor IS NULL)
    );

    IF v_actor IS NULL THEN
      INSERT INTO deal_activities (deal_id, activity_type, description, metadata)
      VALUES (NEW.id, 'owner_change', v_desc, v_meta);
    ELSE
      INSERT INTO deal_activities (deal_id, activity_type, description, user_id, metadata)
      VALUES (NEW.id, 'owner_change', v_desc, v_actor, v_meta);
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NULL;
END; $$;

-- 4. closer_change: mudança isolada de r1/r2_closer_email
CREATE OR REPLACE FUNCTION public.log_deal_closer_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_actor uuid; v_actor_name text; v_actor_email text; v_meta jsonb; v_desc text; v_changed text[] := ARRAY[]::text[];
BEGIN
  BEGIN
    IF OLD.r1_closer_email IS DISTINCT FROM NEW.r1_closer_email THEN v_changed := v_changed || 'r1_closer_email'; END IF;
    IF OLD.r2_closer_email IS DISTINCT FROM NEW.r2_closer_email THEN v_changed := v_changed || 'r2_closer_email'; END IF;
    IF array_length(v_changed, 1) IS NULL THEN RETURN NULL; END IF;

    v_actor := auth.uid();
    v_actor_name := public.resolve_actor_name(v_actor);
    v_actor_email := public.resolve_actor_email(v_actor);
    v_desc := 'Closer alterado (' || array_to_string(v_changed, ', ') || ')';
    v_meta := jsonb_build_object(
      'previous_r1_closer_email', OLD.r1_closer_email,
      'new_r1_closer_email', NEW.r1_closer_email,
      'previous_r2_closer_email', OLD.r2_closer_email,
      'new_r2_closer_email', NEW.r2_closer_email,
      'changed_fields', to_jsonb(v_changed),
      'changed_at', now(),
      'moved_by_name', v_actor_name,
      'moved_by_email', v_actor_email,
      'source', 'trigger',
      'actor_missing', (v_actor IS NULL)
    );

    IF v_actor IS NULL THEN
      INSERT INTO deal_activities (deal_id, activity_type, description, metadata)
      VALUES (NEW.id, 'closer_change', v_desc, v_meta);
    ELSE
      INSERT INTO deal_activities (deal_id, activity_type, description, user_id, metadata)
      VALUES (NEW.id, 'closer_change', v_desc, v_actor, v_meta);
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_log_deal_owner_change ON public.crm_deals;
CREATE TRIGGER trg_log_deal_owner_change
AFTER UPDATE OF owner_id, owner_profile_id ON public.crm_deals
FOR EACH ROW
WHEN (OLD.owner_id IS DISTINCT FROM NEW.owner_id OR OLD.owner_profile_id IS DISTINCT FROM NEW.owner_profile_id)
EXECUTE FUNCTION public.log_deal_owner_change();

DROP TRIGGER IF EXISTS trg_log_deal_closer_change ON public.crm_deals;
CREATE TRIGGER trg_log_deal_closer_change
AFTER UPDATE OF r1_closer_email, r2_closer_email ON public.crm_deals
FOR EACH ROW
WHEN (OLD.r1_closer_email IS DISTINCT FROM NEW.r1_closer_email OR OLD.r2_closer_email IS DISTINCT FROM NEW.r2_closer_email)
EXECUTE FUNCTION public.log_deal_closer_change();

-- 5. Redação de dado pessoal nos snapshots de auditoria
CREATE OR REPLACE FUNCTION public.redact_audit_snapshot(_data jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE WHEN _data IS NULL THEN NULL ELSE _data
    - 'cpf' - 'cpf_conjuge' - 'rg' - 'cnpj' - 'renda' - 'patrimonio' - 'pix'
    - 'endereco_completo' - 'endereco_cep' - 'endereco_comercial' - 'endereco_comercial_cep'
    - 'telefone' - 'telefone_comercial' - 'email' - 'email_comercial'
    - 'nome_completo' - 'razao_social' - 'profissao' - 'socios'
    - 'natureza_juridica' - 'inscricao_estadual' - 'data_fundacao'
    - 'num_funcionarios' - 'faturamento_mensal' - 'proposal_details' - 'observacoes'
  END;
$$;

CREATE OR REPLACE FUNCTION public.log_generic_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  BEGIN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (
      auth.uid(), TG_OP, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id),
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE public.redact_audit_snapshot(to_jsonb(OLD)) END,
      CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE public.redact_audit_snapshot(to_jsonb(NEW)) END
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NULL;
END; $$;

-- 6. Limpeza retroativa de dado pessoal já copiado
UPDATE public.audit_logs
SET old_data = public.redact_audit_snapshot(old_data),
    new_data = public.redact_audit_snapshot(new_data)
WHERE table_name IN ('consorcio_pending_registrations','consorcio_proposals');