CREATE OR REPLACE FUNCTION sync_employee_squad_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    WHERE LOWER(email) = LOWER(NEW.email_pessoal);
  END IF;

  PERFORM set_config('app.syncing_squad', 'false', true);

  RETURN NEW;
END;
$$;