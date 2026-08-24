create or replace function public.wa_responsaveis_conversas()
returns table(assigned_to uuid, nome text, total integer, nao_lidas integer, precisa_resposta integer)
language sql
stable
security definer
set search_path to 'public'
as $$
  -- Lista de responsáveis com contagem, para o seletor do inbox.
  -- Restrita a admin/manager: SDR comum não precisa ver a fila dos outros.
  select c.assigned_to,
         coalesce(p.full_name, p.email, '(sem responsável)') as nome,
         count(*)::int as total,
         coalesce(sum(c.unread_count), 0)::int as nao_lidas,
         count(*) filter (where c.unread_count > 0)::int as precisa_resposta
    from public.wa_conversations c
    left join public.profiles p on p.id = c.assigned_to
   where public.has_role(auth.uid(), 'admin')
      or public.has_role(auth.uid(), 'manager')
   group by c.assigned_to, coalesce(p.full_name, p.email, '(sem responsável)')
   order by count(*) desc
$$;

grant execute on function public.wa_responsaveis_conversas() to authenticated;