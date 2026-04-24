-- Remove as versões legadas (3 args) das RPCs de métricas/reuniões da agenda.
-- Essas versões não deduplicam por deal_id e ignoram sdr_squad_history,
-- causando divergência entre o painel "Minhas Reuniões" e o "Painel da Equipe".
-- Após o DROP, o PostgREST resolverá as chamadas para a versão de 4 args
-- (que tem bu_filter DEFAULT NULL) e os números ficarão consistentes.

DROP FUNCTION IF EXISTS public.get_sdr_metrics_from_agenda(text, text, text);
DROP FUNCTION IF EXISTS public.get_sdr_meetings_from_agenda(text, text, text);