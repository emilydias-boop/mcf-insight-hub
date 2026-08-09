REVOKE ALL ON FUNCTION public.operacional_incorporador_comissoes(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.operacional_incorporador_comissoes(date, date) TO service_role, postgres;