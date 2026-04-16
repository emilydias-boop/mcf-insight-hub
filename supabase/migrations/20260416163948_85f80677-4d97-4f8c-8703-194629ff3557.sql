CREATE OR REPLACE FUNCTION public.check_duplicate_deal_by_identity(
  p_email TEXT,
  p_phone_suffix TEXT,
  p_origin_id UUID
) RETURNS UUID AS $$
  SELECT d.id
  FROM crm_deals d
  JOIN crm_contacts c ON c.id = d.contact_id
  WHERE d.origin_id = p_origin_id
    AND d.is_duplicate = false
    AND d.archived_at IS NULL
    AND (
      (p_email IS NOT NULL AND p_email != '' AND LOWER(c.email) = LOWER(p_email))
      OR
      (p_phone_suffix IS NOT NULL AND p_phone_suffix != '' AND c.phone LIKE '%' || p_phone_suffix)
    )
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;