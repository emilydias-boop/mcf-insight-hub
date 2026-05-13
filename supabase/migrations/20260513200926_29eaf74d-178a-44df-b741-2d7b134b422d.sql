
-- Vincular Andre Nucci
UPDATE public.closers
   SET employee_id = '12a50a65-cc95-4299-abbb-fd2ad7b28afc',
       meeting_type = COALESCE(meeting_type, 'r1'),
       bu = COALESCE(bu, 'consorcio'),
       is_active = true,
       updated_at = now()
 WHERE LOWER(email) = 'andre.nucci@minhacasafinanciada.com';

-- Reforçar trigger para garantir que employee_id e meeting_type sejam sempre populados
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
         SET employee_id = COALESCE(employee_id, NEW.id),
             bu = COALESCE(bu, v_bu),
             meeting_type = COALESCE(meeting_type, 'r1'),
             name = COALESCE(NULLIF(name, ''), v_name),
             is_active = true,
             updated_at = now()
       WHERE id = v_existing_closer_id;
    END IF;
  END IF;

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
             active = true,
             updated_at = now()
       WHERE id = v_existing_sdr_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
