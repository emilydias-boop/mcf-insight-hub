-- Backfill: Corrigir leads existentes com owner_profile_id NULL
-- Atualiza owner_profile_id baseado no email do owner_id

UPDATE crm_deals d
SET owner_profile_id = p.id,
    updated_at = NOW()
FROM profiles p
WHERE d.owner_id = p.email
  AND d.owner_profile_id IS NULL
  AND d.owner_id IS NOT NULL;