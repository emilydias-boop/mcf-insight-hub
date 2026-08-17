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

    IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN v_changed := array_append(v_changed, 'owner_id'::text); END IF;
    IF OLD.owner_profile_id IS DISTINCT FROM NEW.owner_profile_id THEN v_changed := array_append(v_changed, 'owner_profile_id'::text); END IF;

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

CREATE OR REPLACE FUNCTION public.log_deal_closer_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_actor uuid; v_actor_name text; v_actor_email text; v_meta jsonb; v_desc text; v_changed text[] := ARRAY[]::text[];
BEGIN
  BEGIN
    IF OLD.r1_closer_email IS DISTINCT FROM NEW.r1_closer_email THEN v_changed := array_append(v_changed, 'r1_closer_email'::text); END IF;
    IF OLD.r2_closer_email IS DISTINCT FROM NEW.r2_closer_email THEN v_changed := array_append(v_changed, 'r2_closer_email'::text); END IF;
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