
-- 1. Corrigir profile_id dos employees sem vínculo (dispara trigger existente trg_auto_link_employee_sdr)
UPDATE employees SET profile_id = '5ac53d91-e131-4abb-9a8a-04745864a509' WHERE id = 'b0e52181-8410-4a5c-b4c2-9d2899eb79db' AND profile_id IS NULL;
UPDATE employees SET profile_id = 'f12d079b-8c99-49b4-9233-4705886e079b' WHERE id = 'eb81c846-17e5-4e35-ad0d-9ee6c601036e' AND profile_id IS NULL;
UPDATE employees SET profile_id = '5646fafc-4351-401a-b71b-412781e90ada' WHERE id = '79c876e9-31b3-48bb-89ef-3fb396dd45de' AND profile_id IS NULL;
UPDATE employees SET profile_id = 'ed0ce5b6-ddfd-468d-9d69-4921ce14da3b' WHERE id = '7e036846-65e4-499c-ab04-5d4458444e56' AND profile_id IS NULL;
UPDATE employees SET profile_id = 'd27c71c8-8afb-4cf4-bf61-777a99e3b188' WHERE id = '7a38e6a4-c8e4-423a-97ec-529ff6a53afc' AND profile_id IS NULL;
UPDATE employees SET profile_id = 'fe247e45-d7de-40ee-a57b-20452e2e7195' WHERE id = '40c24d42-70e5-49be-888a-0121e7f3e2b8' AND profile_id IS NULL;
UPDATE employees SET profile_id = '8e66266d-6436-4481-903b-943b994acecd' WHERE id = '07da7f2a-ec28-4617-acdb-3677a7747307' AND profile_id IS NULL;
UPDATE employees SET profile_id = '992a3790-424f-4126-8ef1-e329e2003f99' WHERE id = 'd22bcd2c-f342-4d57-b6f1-f19a13a93c5d' AND profile_id IS NULL;
UPDATE employees SET profile_id = 'd523e03f-6a23-4668-8286-9ccbba2a5d35' WHERE id = '33fec5b4-acb0-4fd0-9f15-a99eef21a382' AND profile_id IS NULL;

-- 2. Trigger: ao inserir employee, buscar profile por email correspondente
CREATE OR REPLACE FUNCTION public.auto_match_employee_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Se profile_id já está preenchido, não faz nada
  IF NEW.profile_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Buscar profile pelo email_pessoal do employee
  IF NEW.email_pessoal IS NOT NULL AND NEW.email_pessoal != '' THEN
    SELECT id INTO NEW.profile_id
    FROM profiles
    WHERE LOWER(email) = LOWER(NEW.email_pessoal)
    LIMIT 1;
  END IF;

  -- Fallback: buscar por nome similar
  IF NEW.profile_id IS NULL AND NEW.nome_completo IS NOT NULL THEN
    SELECT id INTO NEW.profile_id
    FROM profiles
    WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(NEW.nome_completo))
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_match_employee_profile ON employees;
CREATE TRIGGER trg_auto_match_employee_profile
  BEFORE INSERT ON employees
  FOR EACH ROW
  EXECUTE FUNCTION auto_match_employee_profile();

-- 3. Trigger: ao criar profile, buscar employees sem profile_id
CREATE OR REPLACE FUNCTION public.auto_match_profile_to_employee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  matched_employee_id uuid;
BEGIN
  -- Buscar employee sem profile_id pelo email
  IF NEW.email IS NOT NULL THEN
    SELECT id INTO matched_employee_id
    FROM employees
    WHERE profile_id IS NULL
      AND status = 'ativo'
      AND LOWER(TRIM(email_pessoal)) = LOWER(TRIM(NEW.email))
    LIMIT 1;
  END IF;

  -- Fallback: buscar por nome
  IF matched_employee_id IS NULL AND NEW.full_name IS NOT NULL THEN
    SELECT id INTO matched_employee_id
    FROM employees
    WHERE profile_id IS NULL
      AND status = 'ativo'
      AND LOWER(TRIM(nome_completo)) = LOWER(TRIM(NEW.full_name))
    LIMIT 1;
  END IF;

  -- Atualizar employee com profile_id (dispara trg_auto_link_employee_sdr)
  IF matched_employee_id IS NOT NULL THEN
    UPDATE employees
    SET profile_id = NEW.id
    WHERE id = matched_employee_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_match_profile_to_employee ON profiles;
CREATE TRIGGER trg_auto_match_profile_to_employee
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_match_profile_to_employee();
