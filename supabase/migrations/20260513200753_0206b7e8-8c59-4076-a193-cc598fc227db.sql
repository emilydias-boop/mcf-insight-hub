
-- ============================================================
-- 1. Helper: mapear área do cargo → BU usada em closers
-- ============================================================
CREATE OR REPLACE FUNCTION public.map_area_to_bu(p_area text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE LOWER(COALESCE(p_area, ''))
    WHEN 'consórcio' THEN 'consorcio'
    WHEN 'consorcio' THEN 'consorcio'
    WHEN 'inside sales' THEN 'incorporador'
    WHEN 'crédito' THEN 'credito'
    WHEN 'credito' THEN 'credito'
    ELSE NULL
  END
$$;

-- ============================================================
-- 2. Trigger function: sincroniza employees → closers/sdr
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_employee_operational_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_area text;
  v_bu text;
  v_email text;
  v_name text;
  v_existing_closer_id uuid;
  v_existing_sdr_id uuid;
BEGIN
  -- Sai cedo se não tem cargo definido
  IF NEW.cargo_catalogo_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role_sistema, area
    INTO v_role, v_area
  FROM public.cargos_catalogo
  WHERE id = NEW.cargo_catalogo_id;

  IF v_role IS NULL THEN
    RETURN NEW;
  END IF;

  v_bu := public.map_area_to_bu(v_area);
  v_email := LOWER(TRIM(COALESCE(NEW.email_pessoal, '')));
  v_name := COALESCE(NULLIF(TRIM(NEW.nome_completo), ''), v_email);

  IF v_email = '' THEN
    RETURN NEW;
  END IF;

  -- ---------- CLOSER / CLOSER_SOMBRA ----------
  IF v_role IN ('closer', 'closer_sombra') THEN
    SELECT id INTO v_existing_closer_id
    FROM public.closers
    WHERE employee_id = NEW.id
       OR LOWER(email) = v_email
    LIMIT 1;

    IF v_existing_closer_id IS NULL THEN
      INSERT INTO public.closers (
        name, email, employee_id, bu, meeting_type, is_active
      ) VALUES (
        v_name, v_email, NEW.id, v_bu, 'r1', true
      );
    ELSE
      UPDATE public.closers
         SET employee_id = NEW.id,
             name = COALESCE(NULLIF(name, ''), v_name),
             bu = COALESCE(bu, v_bu),
             updated_at = now()
       WHERE id = v_existing_closer_id;
    END IF;
  END IF;

  -- ---------- SDR ----------
  IF v_role = 'sdr' THEN
    SELECT id INTO v_existing_sdr_id
    FROM public.sdr
    WHERE LOWER(email) = v_email
    LIMIT 1;

    IF v_existing_sdr_id IS NULL THEN
      INSERT INTO public.sdr (
        name, email, user_id, role_type, active, status
      ) VALUES (
        v_name, v_email, NEW.user_id, 'sdr', true, 'aprovado'
      );
    ELSE
      UPDATE public.sdr
         SET user_id = COALESCE(user_id, NEW.user_id),
             name = COALESCE(NULLIF(name, ''), v_name),
             updated_at = now()
       WHERE id = v_existing_sdr_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_employee_operational_role ON public.employees;
CREATE TRIGGER trg_sync_employee_operational_role
AFTER INSERT OR UPDATE OF cargo_catalogo_id, nome_completo, email_pessoal, user_id
ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.sync_employee_operational_role();

-- ============================================================
-- 3. Backfill: employees.user_id a partir de profile_id
-- ============================================================
UPDATE public.employees e
   SET user_id = e.profile_id
 WHERE e.user_id IS NULL
   AND e.profile_id IS NOT NULL
   AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = e.profile_id);

-- ============================================================
-- 4. Backfill: cria closer/sdr para colaboradores existentes
-- ============================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT e.id
      FROM public.employees e
      JOIN public.cargos_catalogo c ON c.id = e.cargo_catalogo_id
     WHERE c.role_sistema IN ('closer', 'closer_sombra', 'sdr')
       AND COALESCE(e.email_pessoal, '') <> ''
  LOOP
    -- dispara trigger via UPDATE no-op
    UPDATE public.employees SET cargo_catalogo_id = cargo_catalogo_id WHERE id = r.id;
  END LOOP;
END $$;
