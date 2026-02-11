
-- ============================================================
-- 1. Função trigger: auto_link_employee_sdr()
-- Vincula automaticamente employee à tabela sdr quando profile_id é preenchido
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_link_employee_sdr()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_sdr_id UUID;
  v_squad TEXT;
  v_role_type TEXT;
  v_role_sistema TEXT;
BEGIN
  -- Só executar se profile_id está sendo preenchido (novo ou alterado)
  IF NEW.profile_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.profile_id IS DISTINCT FROM NEW.profile_id) THEN
    
    -- 1. Buscar email do profile
    SELECT email INTO v_email
    FROM profiles
    WHERE id = NEW.profile_id;
    
    IF v_email IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- 2. Buscar SDR existente por email
    SELECT id INTO v_sdr_id
    FROM sdr
    WHERE LOWER(email) = LOWER(v_email)
    LIMIT 1;
    
    IF v_sdr_id IS NOT NULL THEN
      -- 3. Encontrou: apenas vincular
      NEW.sdr_id := v_sdr_id;
      
      -- Atualizar user_id no sdr se estiver null
      UPDATE sdr SET user_id = NEW.profile_id WHERE id = v_sdr_id AND user_id IS NULL;
    ELSE
      -- 4. Não encontrou: criar novo registro na sdr
      
      -- Mapear departamento para squad
      v_squad := CASE
        WHEN NEW.departamento ILIKE '%incorporador%' OR NEW.departamento ILIKE '%50k%' THEN 'incorporador'
        WHEN NEW.departamento ILIKE '%cons_rcio%' OR NEW.departamento ILIKE '%consorcio%' THEN 'consorcio'
        WHEN NEW.departamento ILIKE '%cr_dito%' OR NEW.departamento ILIKE '%credito%' THEN 'credito'
        WHEN NEW.departamento ILIKE '%leil_o%' OR NEW.departamento ILIKE '%leilao%' THEN 'leilao'
        ELSE 'credito'
      END;
      
      -- Buscar role_sistema do cargo_catalogo se disponível
      v_role_type := 'sdr'; -- padrão
      IF NEW.cargo_catalogo_id IS NOT NULL THEN
        SELECT role_sistema INTO v_role_sistema
        FROM cargos_catalogo
        WHERE id = NEW.cargo_catalogo_id;
        
        IF v_role_sistema IS NOT NULL AND LOWER(v_role_sistema) LIKE '%closer%' THEN
          v_role_type := 'closer';
        END IF;
      END IF;
      
      -- Inserir na sdr
      INSERT INTO sdr (name, email, squad, role_type, active, meta_diaria, user_id)
      VALUES (NEW.nome_completo, v_email, v_squad, v_role_type, true, 7, NEW.profile_id)
      RETURNING id INTO v_sdr_id;
      
      NEW.sdr_id := v_sdr_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. Trigger na tabela employees
-- ============================================================
DROP TRIGGER IF EXISTS trg_auto_link_employee_sdr ON employees;

CREATE TRIGGER trg_auto_link_employee_sdr
  BEFORE INSERT OR UPDATE OF profile_id
  ON employees
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_employee_sdr();

-- ============================================================
-- 3. Correção dos dados existentes - vincular employees com sdr existente
-- ============================================================
UPDATE employees e
SET sdr_id = s.id
FROM profiles p
JOIN sdr s ON LOWER(s.email) = LOWER(p.email)
WHERE e.profile_id = p.id
  AND e.sdr_id IS NULL
  AND e.status = 'ativo';

-- ============================================================
-- 4. Criar registros sdr para employees ativos com profile mas sem sdr
-- ============================================================
WITH employees_sem_sdr AS (
  SELECT 
    e.id as employee_id,
    e.nome_completo,
    e.profile_id,
    e.departamento,
    e.cargo_catalogo_id,
    p.email,
    CASE
      WHEN e.departamento ILIKE '%incorporador%' OR e.departamento ILIKE '%50k%' THEN 'incorporador'
      WHEN e.departamento ILIKE '%cons_rcio%' OR e.departamento ILIKE '%consorcio%' THEN 'consorcio'
      WHEN e.departamento ILIKE '%cr_dito%' OR e.departamento ILIKE '%credito%' THEN 'credito'
      WHEN e.departamento ILIKE '%leil_o%' OR e.departamento ILIKE '%leilao%' THEN 'leilao'
      ELSE 'credito'
    END as mapped_squad,
    CASE 
      WHEN cc.role_sistema IS NOT NULL AND LOWER(cc.role_sistema) LIKE '%closer%' THEN 'closer'
      ELSE 'sdr'
    END as mapped_role
  FROM employees e
  JOIN profiles p ON p.id = e.profile_id
  LEFT JOIN cargos_catalogo cc ON cc.id = e.cargo_catalogo_id
  WHERE e.profile_id IS NOT NULL
    AND e.sdr_id IS NULL
    AND e.status = 'ativo'
    AND NOT EXISTS (SELECT 1 FROM sdr s WHERE LOWER(s.email) = LOWER(p.email))
),
inserted_sdrs AS (
  INSERT INTO sdr (name, email, squad, role_type, active, meta_diaria, user_id)
  SELECT 
    nome_completo,
    email,
    mapped_squad,
    mapped_role,
    true,
    7,
    profile_id
  FROM employees_sem_sdr
  RETURNING id, email
)
UPDATE employees e
SET sdr_id = ins.id
FROM inserted_sdrs ins
JOIN profiles p ON LOWER(p.email) = LOWER(ins.email)
WHERE e.profile_id = p.id
  AND e.sdr_id IS NULL;
