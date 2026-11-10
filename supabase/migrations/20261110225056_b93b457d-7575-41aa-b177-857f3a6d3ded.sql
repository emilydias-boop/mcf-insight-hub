REVOKE ALL ON FUNCTION public.trg_war_room_autovincular() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.war_room_autovincular(uuid, boolean) FROM PUBLIC, anon, authenticated;