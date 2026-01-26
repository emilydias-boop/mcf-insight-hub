-- Fase 4: Migrar CRM owner_id para UUID

-- Etapa 1A: Remover FK constraint que exige auth.users
-- Isso permite criar profiles para ex-funcionários sem conta ativa
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Etapa 1B: Criar profiles inativos para ex-funcionários
INSERT INTO profiles (id, email, full_name, access_status)
SELECT 
  gen_random_uuid() as id,
  orphan.owner_email as email,
  INITCAP(REPLACE(SPLIT_PART(orphan.owner_email, '@', 1), '.', ' ')) as full_name,
  'desativado' as access_status
FROM (
  SELECT DISTINCT owner_id as owner_email
  FROM crm_deals 
  WHERE owner_id LIKE '%@%'
    AND owner_id IS NOT NULL
    AND owner_id != ''
) orphan
LEFT JOIN profiles p ON orphan.owner_email = p.email
WHERE p.id IS NULL;

-- Etapa 2: Adicionar coluna owner_profile_id
ALTER TABLE crm_deals 
ADD COLUMN IF NOT EXISTS owner_profile_id UUID REFERENCES profiles(id);

-- Etapa 3: Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_crm_deals_owner_profile_id 
ON crm_deals(owner_profile_id);

-- Etapa 4: Migrar dados existentes (preencher owner_profile_id baseado no email)
UPDATE crm_deals d
SET owner_profile_id = p.id
FROM profiles p
WHERE d.owner_id = p.email
  AND d.owner_profile_id IS NULL;