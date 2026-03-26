
-- Trigger 1: employees → profiles (+ sdr)
CREATE OR REPLACE FUNCTION public.sync_employee_squad_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  mapped_squad TEXT;
  dept TEXT;
BEGIN
  IF current_setting('app.syncing_squad', true) = 'true' THEN
    RETURN NEW;
  END IF;

  dept := COALESCE(NEW.departamento, '');
  mapped_squad := CASE
    WHEN NEW.squad IS NOT NULL AND NEW.squad != '' THEN
      CASE
        WHEN LOWER(NEW.squad) ILIKE '%incorporador%' THEN 'incorporador'
        WHEN LOWER(NEW.squad) ILIKE '%consorcio%' OR LOWER(NEW.squad) ILIKE '%consórcio%' THEN 'consorcio'
        WHEN LOWER(NEW.squad) ILIKE '%credito%' OR LOWER(NEW.squad) ILIKE '%crédito%' THEN 'credito'
        WHEN LOWER(NEW.squad) ILIKE '%leilao%' OR LOWER(NEW.squad) ILIKE '%leilão%' THEN 'leilao'
        WHEN LOWER(NEW.squad) ILIKE '%marketing%' THEN 'marketing'
        WHEN LOWER(NEW.squad) ILIKE '%projetos%' THEN 'projetos'
        ELSE LOWER(NEW.squad)
      END
    WHEN dept ILIKE '%incorporador%' OR dept ILIKE '%50k%' THEN 'incorporador'
    WHEN dept ILIKE '%consorcio%' OR dept ILIKE '%consórcio%' THEN 'consorcio'
    WHEN dept ILIKE '%credito%' OR dept ILIKE '%crédito%' THEN 'credito'
    WHEN dept ILIKE '%leilao%' OR dept ILIKE '%leilão%' THEN 'leilao'
    WHEN dept ILIKE '%marketing%' THEN 'marketing'
    WHEN dept ILIKE '%projetos%' THEN 'projetos'
    ELSE NULL
  END;

  IF mapped_squad IS NULL OR NEW.profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('app.syncing_squad', 'true', true);

  UPDATE profiles
  SET squad = ARRAY[mapped_squad]::text[]
  WHERE id = NEW.profile_id;

  IF NEW.sdr_id IS NOT NULL THEN
    UPDATE sdr SET squad = mapped_squad WHERE id = NEW.sdr_id;
  ELSE
    UPDATE sdr SET squad = mapped_squad
    WHERE LOWER(email) = LOWER(NEW.email_corporativo)
      OR LOWER(email) = LOWER(NEW.email_pessoal);
  END IF;

  PERFORM set_config('app.syncing_squad', 'false', true);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_employee_squad_to_profile ON employees;
CREATE TRIGGER trg_sync_employee_squad_to_profile
  AFTER INSERT OR UPDATE OF squad, departamento ON employees
  FOR EACH ROW
  EXECUTE FUNCTION sync_employee_squad_to_profile();

-- Trigger 2: profiles → employees (+ sdr)
CREATE OR REPLACE FUNCTION public.sync_profile_squad_to_employee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  first_squad TEXT;
BEGIN
  IF current_setting('app.syncing_squad', true) = 'true' THEN
    RETURN NEW;
  END IF;

  first_squad := NEW.squad[1];

  IF first_squad IS NULL OR first_squad = '' THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('app.syncing_squad', 'true', true);

  UPDATE employees
  SET squad = first_squad
  WHERE profile_id = NEW.id;

  UPDATE sdr
  SET squad = first_squad
  WHERE user_id = NEW.id
     OR LOWER(email) = LOWER(NEW.email);

  PERFORM set_config('app.syncing_squad', 'false', true);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_squad_to_employee ON profiles;
CREATE TRIGGER trg_sync_profile_squad_to_employee
  AFTER UPDATE OF squad ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_profile_squad_to_employee();

-- Data fix: sync existing employees → profiles
UPDATE profiles p
SET squad = ARRAY[
  CASE
    WHEN e.departamento ILIKE '%incorporador%' OR e.departamento ILIKE '%50k%' THEN 'incorporador'
    WHEN e.departamento ILIKE '%consorcio%' OR e.departamento ILIKE '%consórcio%' THEN 'consorcio'
    WHEN e.departamento ILIKE '%credito%' OR e.departamento ILIKE '%crédito%' THEN 'credito'
    WHEN e.departamento ILIKE '%leilao%' OR e.departamento ILIKE '%leilão%' THEN 'leilao'
    WHEN e.departamento ILIKE '%marketing%' THEN 'marketing'
    WHEN e.departamento ILIKE '%projetos%' THEN 'projetos'
    ELSE LOWER(COALESCE(e.squad, ''))
  END
]::text[]
FROM employees e
WHERE e.profile_id = p.id
  AND e.status = 'ativo'
  AND (
    (e.departamento IS NOT NULL AND e.departamento != '')
    OR (e.squad IS NOT NULL AND e.squad != '')
  )
  AND (p.squad IS NULL OR p.squad = '{}');

-- Also sync from sdr table for users without employee link
UPDATE profiles p
SET squad = ARRAY[s.squad]::text[]
FROM sdr s
WHERE s.user_id = p.id
  AND s.active = true
  AND s.squad IS NOT NULL
  AND s.squad != ''
  AND (p.squad IS NULL OR p.squad = '{}');
