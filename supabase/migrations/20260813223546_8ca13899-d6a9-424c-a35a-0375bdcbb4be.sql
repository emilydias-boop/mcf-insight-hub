CREATE OR REPLACE FUNCTION public.sync_owner_profile_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text := lower(nullif(btrim(coalesce(NEW.owner_id, '')), ''));
  v_active_count int := 0;
  v_profile_id uuid;
  v_current_matches boolean := false;
BEGIN
  IF v_email IS NULL THEN
    RETURN NEW;
  END IF;

  -- Conta apenas profiles elegíveis (ativos ou legado sem status)
  SELECT count(*), min(id)
    INTO v_active_count, v_profile_id
  FROM public.profiles
  WHERE lower(email) = v_email
    AND (access_status IS NULL OR access_status = 'ativo');

  -- O vínculo atual já aponta para um profile ativo com esse email?
  IF NEW.owner_profile_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = NEW.owner_profile_id
        AND lower(email) = v_email
        AND (access_status IS NULL OR access_status = 'ativo')
    ) INTO v_current_matches;
  END IF;

  IF v_current_matches THEN
    RETURN NEW;
  END IF;

  -- Só (re)sincroniza quando existe exatamente 1 profile ativo com o email
  IF v_active_count = 1 THEN
    NEW.owner_profile_id := v_profile_id;
  ELSIF NEW.owner_profile_id IS NULL THEN
    RAISE WARNING 'sync_owner_profile_id: % profiles ativos para o email % (deal %); owner_profile_id mantido nulo',
      v_active_count, v_email, NEW.id;
  ELSE
    RAISE WARNING 'sync_owner_profile_id: % profiles ativos para o email % (deal %); owner_profile_id atual mantido',
      v_active_count, v_email, NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;