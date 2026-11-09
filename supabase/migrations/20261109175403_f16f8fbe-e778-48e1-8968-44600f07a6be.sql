CREATE SCHEMA IF NOT EXISTS pv_private;
REVOKE ALL ON SCHEMA pv_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA pv_private TO authenticated, service_role;
ALTER FUNCTION public.pos_venda_encaminhar_bu(uuid, text) SET SCHEMA pv_private;
REVOKE ALL ON FUNCTION pv_private.pos_venda_encaminhar_bu(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pv_private.pos_venda_encaminhar_bu(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pos_venda_encaminhar_bu(p_deal_id uuid, p_bu text)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path = public
AS $$ SELECT pv_private.pos_venda_encaminhar_bu(p_deal_id, p_bu) $$;
REVOKE ALL ON FUNCTION public.pos_venda_encaminhar_bu(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_venda_encaminhar_bu(uuid, text) TO authenticated, service_role;