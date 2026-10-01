create or replace function public.ar_gerente_conta_por_titulo(p_titulo_id uuid default null)
returns table(titulo_id uuid, gerente_nome text, gerente_email text, gerente_telefone text, area text, recebido_em timestamptz)
language sql stable security definer set search_path = public as $$
  select t.id, e.gerente_nome, e.gerente_email,
         e.payload_original->'gerente'->>'telefone', e.area, e.recebido_em
  from ar_titulos t
  cross join lateral (
    select x.* from crm_externo_encaminhamentos x
    where x.gerente_nome is not null and (
      (nullif(regexp_replace(coalesce(t.customer_document,''),'\D','','g'),'') is not null
        and regexp_replace(coalesce(x.cliente_documento,''),'\D','','g') = regexp_replace(t.customer_document,'\D','','g'))
      or (t.customer_email is not null and lower(trim(x.cliente_email)) = lower(trim(t.customer_email))))
    order by (regexp_replace(coalesce(x.cliente_documento,''),'\D','','g') = regexp_replace(coalesce(t.customer_document,''),'\D','','g')) desc,
             x.recebido_em desc nulls last
    limit 1
  ) e
  where public.can_manage_ar(auth.uid()) and (p_titulo_id is null or t.id = p_titulo_id);
$$;
revoke all on function public.ar_gerente_conta_por_titulo(uuid) from public, anon;
grant execute on function public.ar_gerente_conta_por_titulo(uuid) to authenticated;