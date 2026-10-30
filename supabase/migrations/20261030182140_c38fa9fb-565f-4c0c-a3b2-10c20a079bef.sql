revoke all on function public.presenca_e_lider(text) from public, anon;
revoke all on function public.presenca_pode_ver(text) from public, anon;
grant execute on function public.presenca_e_lider(text) to authenticated, service_role;
grant execute on function public.presenca_pode_ver(text) to authenticated, service_role;