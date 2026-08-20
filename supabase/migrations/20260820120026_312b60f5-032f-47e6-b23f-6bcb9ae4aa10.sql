REVOKE EXECUTE ON FUNCTION public.listar_agendadores_disponiveis() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.corrigir_agendador_reuniao(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.agendador_ajuste_info(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.listar_agendadores_disponiveis() TO authenticated;
GRANT EXECUTE ON FUNCTION public.corrigir_agendador_reuniao(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agendador_ajuste_info(uuid) TO authenticated;