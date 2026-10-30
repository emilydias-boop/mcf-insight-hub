do $$
declare d text;
begin
  d := pg_get_functiondef('public.equipe_agora(date)'::regprocedure);
  d := replace(d, $x$'fora_da_conta', not p.conta,$x$, $x$'fora_da_conta', coalesce(p.regra = 'fora_da_conta', false),$x$);
  execute d;
  d := pg_get_functiondef('public.capacidade_dia(date, text)'::regprocedure);
  d := replace(d, $x$where regra = 'fora_da_conta' or (regra is null and not conta)$x$, $x$where regra = 'fora_da_conta'$x$);
  execute d;
end $$;
revoke all on function public.equipe_agora(date) from public, anon, authenticated;
grant execute on function public.equipe_agora(date) to service_role;
revoke all on function public.capacidade_dia(date, text) from public, anon;
grant execute on function public.capacidade_dia(date, text) to authenticated, service_role;