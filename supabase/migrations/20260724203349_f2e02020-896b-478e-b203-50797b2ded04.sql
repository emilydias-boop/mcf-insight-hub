CREATE OR REPLACE FUNCTION public.export_all_contacts_page(p_offset int, p_limit int)
RETURNS TABLE (
  id uuid, clint_id text, name text, email text, phone text, origin_id uuid,
  organization_name text, tags text, custom_fields text,
  created_at timestamptz, updated_at timestamptz, notes text,
  merged_into_contact_id uuid, merged_at timestamptz, is_archived boolean,
  origin_name text, bu text, etapa text, etapa_color text,
  deal_id uuid, deal_created_at timestamptz, deal_stage_moved_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.clint_id, c.name, c.email, c.phone, c.origin_id,
         c.organization_name, c.tags::text, c.custom_fields::text,
         c.created_at, c.updated_at, c.notes,
         c.merged_into_contact_id, c.merged_at, c.is_archived,
         o.name, m.bu, s.stage_name, s.color,
         d.id, d.created_at, d.stage_moved_at
  FROM public.crm_contacts c
  LEFT JOIN LATERAL (
    SELECT * FROM public.crm_deals d2
    WHERE d2.contact_id = c.id
    ORDER BY d2.created_at DESC NULLS LAST
    LIMIT 1
  ) d ON TRUE
  LEFT JOIN public.crm_origins o ON o.id = d.origin_id
  LEFT JOIN public.crm_stages s ON s.id = d.stage_id
  LEFT JOIN public.bu_origin_mapping m ON m.entity_id::uuid = d.origin_id AND m.entity_type = 'origin'
  WHERE c.is_archived IS NOT TRUE
  ORDER BY c.created_at DESC NULLS LAST, c.id
  OFFSET p_offset LIMIT p_limit;
$$;
REVOKE ALL ON FUNCTION public.export_all_contacts_page(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.export_all_contacts_page(int, int) TO service_role;