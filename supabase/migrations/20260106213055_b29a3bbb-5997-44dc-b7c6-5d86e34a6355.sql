-- Função para encontrar emails duplicados de forma eficiente
CREATE OR REPLACE FUNCTION get_duplicate_contact_emails(limit_count integer DEFAULT 100)
RETURNS TABLE(email text, contact_count bigint) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT c.email::text, COUNT(*)::bigint as contact_count
  FROM crm_contacts c
  WHERE c.email IS NOT NULL 
    AND c.email != ''
    AND TRIM(c.email) != ''
  GROUP BY LOWER(TRIM(c.email)), c.email
  HAVING COUNT(*) > 1
  ORDER BY COUNT(*) DESC
  LIMIT limit_count;
END;
$$;