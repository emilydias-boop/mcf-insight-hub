REVOKE ALL ON FUNCTION public.jornada_tg_deal_before() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.jornada_tg_deal_evento() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.jornada_tg_nota() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.jornada_etapa_alvo(uuid,uuid,uuid,jsonb,uuid) FROM PUBLIC, anon, authenticated;