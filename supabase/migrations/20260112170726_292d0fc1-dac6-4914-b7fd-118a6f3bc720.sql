-- Criar função para buscar duplicados por telefone (últimos 9 dígitos)
CREATE OR REPLACE FUNCTION get_duplicate_contact_phones(limit_count INT DEFAULT 100)
RETURNS TABLE(phone_suffix TEXT, contact_count BIGINT) AS $$
  SELECT 
    RIGHT(REGEXP_REPLACE(phone, '\D', '', 'g'), 9) as phone_suffix, 
    COUNT(*) as contact_count
  FROM crm_contacts
  WHERE phone IS NOT NULL 
    AND LENGTH(REGEXP_REPLACE(phone, '\D', '', 'g')) >= 9
  GROUP BY RIGHT(REGEXP_REPLACE(phone, '\D', '', 'g'), 9)
  HAVING COUNT(*) > 1
  ORDER BY COUNT(*) DESC
  LIMIT limit_count;
$$ LANGUAGE sql;

-- Atualizar função de emails para também retornar meetings_count
CREATE OR REPLACE FUNCTION get_duplicate_contact_emails(limit_count INT DEFAULT 100)
RETURNS TABLE(email TEXT, contact_count BIGINT) AS $$
  SELECT LOWER(email), COUNT(*) as contact_count
  FROM crm_contacts
  WHERE email IS NOT NULL
  GROUP BY LOWER(email)
  HAVING COUNT(*) > 1
  ORDER BY COUNT(*) DESC
  LIMIT limit_count;
$$ LANGUAGE sql;