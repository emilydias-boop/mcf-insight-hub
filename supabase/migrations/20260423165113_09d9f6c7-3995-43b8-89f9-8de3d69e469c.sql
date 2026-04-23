CREATE OR REPLACE FUNCTION public.sync_profile_squad_to_employee()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  chosen_squad TEXT;
BEGIN
  IF current_setting('app.syncing_squad', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.squad IS NULL OR array_length(NEW.squad, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Priorizar squads operacionais sobre 'a010' (que é fallback/canal)
  -- Ordem: incorporador > consorcio > credito > leilao > marketing > projetos > primeiro item
  SELECT s INTO chosen_squad
  FROM unnest(NEW.squad) AS s
  WHERE LOWER(s) = 'incorporador'
  LIMIT 1;

  IF chosen_squad IS NULL THEN
    SELECT s INTO chosen_squad
    FROM unnest(NEW.squad) AS s
    WHERE LOWER(s) IN ('consorcio', 'consórcio')
    LIMIT 1;
  END IF;

  IF chosen_squad IS NULL THEN
    SELECT s INTO chosen_squad
    FROM unnest(NEW.squad) AS s
    WHERE LOWER(s) IN ('credito', 'crédito')
    LIMIT 1;
  END IF;

  IF chosen_squad IS NULL THEN
    SELECT s INTO chosen_squad
    FROM unnest(NEW.squad) AS s
    WHERE LOWER(s) IN ('leilao', 'leilão')
    LIMIT 1;
  END IF;

  IF chosen_squad IS NULL THEN
    SELECT s INTO chosen_squad
    FROM unnest(NEW.squad) AS s
    WHERE LOWER(s) = 'marketing'
    LIMIT 1;
  END IF;

  IF chosen_squad IS NULL THEN
    SELECT s INTO chosen_squad
    FROM unnest(NEW.squad) AS s
    WHERE LOWER(s) = 'projetos'
    LIMIT 1;
  END IF;

  -- Fallback: primeiro elemento não vazio (mantém comportamento antigo se não houver squad operacional)
  IF chosen_squad IS NULL THEN
    chosen_squad := NEW.squad[1];
  END IF;

  IF chosen_squad IS NULL OR chosen_squad = '' THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('app.syncing_squad', 'true', true);

  UPDATE employees
  SET squad = chosen_squad
  WHERE profile_id = NEW.id;

  UPDATE sdr
  SET squad = chosen_squad
  WHERE user_id = NEW.id
     OR LOWER(email) = LOWER(NEW.email);

  PERFORM set_config('app.syncing_squad', 'false', true);

  RETURN NEW;
END;
$function$;