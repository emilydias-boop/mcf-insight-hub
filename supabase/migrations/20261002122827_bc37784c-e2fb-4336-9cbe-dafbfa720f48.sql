REVOKE ALL ON FUNCTION public.can_edit_bi_solar_meta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_bi_solar_meta(uuid) TO authenticated, service_role;