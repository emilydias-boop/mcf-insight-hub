-- Passo 2: Corrigir dados existentes - sincronizar owner_profile_id
UPDATE crm_deals d
SET owner_profile_id = p.id
FROM profiles p
WHERE LOWER(d.owner_id) = LOWER(p.email)
  AND d.owner_profile_id IS NULL
  AND d.owner_id IS NOT NULL;

-- Passo 3: Trigger de segurança para auto-sync permanente
CREATE OR REPLACE FUNCTION public.sync_owner_profile_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL AND NEW.owner_profile_id IS NULL THEN
    SELECT id INTO NEW.owner_profile_id
    FROM profiles
    WHERE LOWER(email) = LOWER(NEW.owner_id)
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_sync_owner_profile_id
BEFORE INSERT OR UPDATE ON crm_deals
FOR EACH ROW
EXECUTE FUNCTION public.sync_owner_profile_id();