-- =====================================================================
-- Ampliação do filtro de público do disparo de WhatsApp
-- 1) RPCs de listagem cientes do escopo (minha_carteira / bu)
-- 2) montar_publico entende stage_ids / tags / deal_ids (múltiplos valores)
-- 3) RPC para criar disparo a partir de seleção de negócios
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Estágios disponíveis, respeitando o escopo do disparo.
-- A antiga wa_broadcast_estagios_disponiveis (só carteira própria)
-- continua existindo e NÃO é alterada, para não quebrar o caminho atual.
-- ---------------------------------------------------------------------
create or replace function public.wa_broadcast_estagios_no_escopo(
  _escopo text,
  _bu text default null,
  _origin_id uuid default null
)
returns table(stage_id uuid, nome text, leads integer)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  -- escopo 'bu' é privilégio de liderança: mesmo recorte do validar_escopo
  if _escopo = 'bu' then
    if not (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager')) then
      raise exception 'disparo por BU e restrito a admin ou manager';
    end if;
    if nullif(btrim(coalesce(_bu, '')), '') is null then
      raise exception 'escopo bu exige a BU definida';
    end if;
  end if;

  return query
  select d.stage_id, s.stage_name, count(*)::int
    from public.crm_deals d
    join public.crm_contacts c on c.id = d.contact_id
    join public.crm_stages s on s.id = d.stage_id
    left join public.profiles po on po.id = d.owner_profile_id
   where coalesce(d.is_archived, false) = false
     and coalesce(d.is_duplicate, false) = false
     and public.phone_key_br(c.phone) is not null
     and (
       (_escopo = 'minha_carteira' and d.owner_profile_id = auth.uid())
       or
       (_escopo = 'bu' and btrim(_bu) = any(coalesce(po.squad, array[]::text[])))
     )
     and (_origin_id is null or d.origin_id = _origin_id)
   group by d.stage_id, s.stage_name
   having count(*) > 0
   order by count(*) desc, s.stage_name;
end $$;

-- ---------------------------------------------------------------------
-- 2) Tags disponíveis, respeitando o escopo.
-- IMPORTANTE: usa crm_deals.tags (array de texto limpo).
-- crm_contacts.tags guarda JSON serializado como texto (lixo) e não serve.
-- ---------------------------------------------------------------------
create or replace function public.wa_broadcast_tags_no_escopo(
  _escopo text,
  _bu text default null,
  _origin_id uuid default null
)
returns table(tag text, leads integer)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if _escopo = 'bu' then
    if not (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager')) then
      raise exception 'disparo por BU e restrito a admin ou manager';
    end if;
    if nullif(btrim(coalesce(_bu, '')), '') is null then
      raise exception 'escopo bu exige a BU definida';
    end if;
  end if;

  return query
  select t.tag::text, count(*)::int
    from public.crm_deals d
    join public.crm_contacts c on c.id = d.contact_id
    left join public.profiles po on po.id = d.owner_profile_id
    cross join lateral unnest(coalesce(d.tags, array[]::text[])) as t(tag)
   where coalesce(d.is_archived, false) = false
     and coalesce(d.is_duplicate, false) = false
     and public.phone_key_br(c.phone) is not null
     and nullif(btrim(coalesce(t.tag, '')), '') is not null
     and (
       (_escopo = 'minha_carteira' and d.owner_profile_id = auth.uid())
       or
       (_escopo = 'bu' and btrim(_bu) = any(coalesce(po.squad, array[]::text[])))
     )
     and (_origin_id is null or d.origin_id = _origin_id)
   group by t.tag
   order by count(*) desc, t.tag;
end $$;

-- ---------------------------------------------------------------------
-- 3) montar_publico: mesma lógica de antes, WHERE ampliado.
-- Novidades no filtro jsonb: stage_ids[], tags[], deal_ids[].
-- Regra de ouro: chave ausente, nula ou array vazio NÃO filtra nada.
-- Isso evita que a UI zere o público sem querer ao mandar [].
-- Entre estágios: OU. Entre tags: OU (operador && de arrays).
-- Entre dimensões (estágio x tag): E.
-- deal_ids entra DEPOIS do recorte de escopo: restringe, nunca amplia.
-- ---------------------------------------------------------------------
create or replace function public.wa_broadcast_montar_publico(_broadcast_id uuid)
returns table(total integer, elegiveis integer, ignorados integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _b record;
  _cooldown integer;
begin
  select * into _b from public.wa_broadcasts where id = _broadcast_id;
  if not found then raise exception 'disparo % nao encontrado', _broadcast_id; end if;
  if _b.status <> 'rascunho' then
    raise exception 'publico so pode ser montado em rascunho (status atual: %)', _b.status;
  end if;

  perform public.wa_broadcast_validar_escopo(_broadcast_id);

  select cooldown_dias into _cooldown from public.wa_send_budget where id;

  delete from public.wa_broadcast_targets where broadcast_id = _broadcast_id;

  insert into public.wa_broadcast_targets (
    broadcast_id, phone_e164, phone_key, deal_id, contact_name,
    owner_profile_id, status, motivo_ignorado
  )
  select base.broadcast_id, base.phone_e164, base.phone_key, base.deal_id, base.contact_name,
         base.owner_profile_id, base.status, base.motivo_ignorado
  from (
    select distinct on (public.phone_key_br(c.phone))
      _broadcast_id as broadcast_id,
      case
        when left(regexp_replace(c.phone,'\D','','g'), 2) = '55'
             and length(regexp_replace(c.phone,'\D','','g')) >= 12
          then '+' || regexp_replace(c.phone,'\D','','g')
        else '+55' || regexp_replace(c.phone,'\D','','g')
      end as phone_e164,
      public.phone_key_br(c.phone) as phone_key,
      d.id as deal_id,
      c.name as contact_name,
      d.owner_profile_id,
      case
        when public.wa_is_opted_out(c.phone) then 'ignorado'
        when not public.wa_dono_ativo(d.owner_profile_id) then 'ignorado'
        when exists (
          select 1 from public.wa_broadcast_targets t2
           where t2.phone_key = public.phone_key_br(c.phone)
             and t2.status = 'enviado'
             and t2.enviado_em > now() - make_interval(days => _cooldown)
        ) then 'ignorado'
        else 'pendente'
      end as status,
      case
        when public.wa_is_opted_out(c.phone) then 'optout'
        when not public.wa_dono_ativo(d.owner_profile_id) then 'dono_inativo'
        when exists (
          select 1 from public.wa_broadcast_targets t2
           where t2.phone_key = public.phone_key_br(c.phone)
             and t2.status = 'enviado'
             and t2.enviado_em > now() - make_interval(days => _cooldown)
        ) then 'cooldown'
        else null
      end as motivo_ignorado,
      d.created_at
    from public.crm_deals d
    join public.crm_contacts c on c.id = d.contact_id
    left join public.profiles po on po.id = d.owner_profile_id
    where coalesce(d.is_archived, false) = false
      and coalesce(d.is_duplicate, false) = false
      and public.phone_key_br(c.phone) is not null
      -- recorte de escopo (inalterado)
      and (
        (_b.escopo = 'minha_carteira' and d.owner_profile_id = _b.criado_por)
        or
        (_b.escopo = 'bu' and btrim(_b.bu) = any(coalesce(po.squad, array[]::text[])))
      )
      -- filtros legados de valor único (retrocompatibilidade)
      and (_b.filtro->>'stage_id' is null or d.stage_id::text = _b.filtro->>'stage_id')
      and (_b.filtro->>'origin_id' is null or d.origin_id::text = _b.filtro->>'origin_id')
      and (_b.filtro->>'criado_de' is null or d.created_at >= (_b.filtro->>'criado_de')::timestamptz)
      and (_b.filtro->>'criado_ate' is null or d.created_at <= (_b.filtro->>'criado_ate')::timestamptz)
      -- múltiplos estágios: OU entre eles; array vazio não filtra
      and (
        _b.filtro->'stage_ids' is null
        or jsonb_typeof(_b.filtro->'stage_ids') <> 'array'
        or jsonb_array_length(_b.filtro->'stage_ids') = 0
        or d.stage_id::text in (select jsonb_array_elements_text(_b.filtro->'stage_ids'))
      )
      -- múltiplas tags: basta ter uma (&&); array vazio não filtra
      and (
        _b.filtro->'tags' is null
        or jsonb_typeof(_b.filtro->'tags') <> 'array'
        or jsonb_array_length(_b.filtro->'tags') = 0
        or coalesce(d.tags, array[]::text[]) && (
             select array_agg(t) from jsonb_array_elements_text(_b.filtro->'tags') as t
           )
      )
      -- seleção explícita de negócios: restringe, nunca amplia o escopo
      and (
        _b.filtro->'deal_ids' is null
        or jsonb_typeof(_b.filtro->'deal_ids') <> 'array'
        or jsonb_array_length(_b.filtro->'deal_ids') = 0
        or d.id::text in (select jsonb_array_elements_text(_b.filtro->'deal_ids'))
      )
    order by public.phone_key_br(c.phone), d.created_at desc
  ) base
  order by base.created_at desc
  limit coalesce(_b.limite_alvos, 2147483647);

  perform public.wa_broadcast_preencher_variaveis(_broadcast_id);

  update public.wa_broadcasts b
     set total_alvos = (select count(*) from public.wa_broadcast_targets t where t.broadcast_id = _broadcast_id),
         total_ignorados = (select count(*) from public.wa_broadcast_targets t where t.broadcast_id = _broadcast_id and t.status = 'ignorado'),
         updated_at = now()
   where b.id = _broadcast_id;

  return query
  select (select count(*)::int from public.wa_broadcast_targets t where t.broadcast_id = _broadcast_id),
         (select count(*)::int from public.wa_broadcast_targets t where t.broadcast_id = _broadcast_id and t.status = 'pendente'),
         (select count(*)::int from public.wa_broadcast_targets t where t.broadcast_id = _broadcast_id and t.status = 'ignorado');
end $function$;

-- ---------------------------------------------------------------------
-- 4) Criar disparo a partir de uma seleção de negócios do CRM.
-- Admin/manager dispara por BU (uma só) e não sobre a base inteira.
-- ---------------------------------------------------------------------
create or replace function public.wa_broadcast_criar_de_selecao(
  _nome text,
  _deal_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _uid uuid := auth.uid();
  _is_lider boolean;
  _fora integer;
  _bus text[];
  _id uuid;
begin
  if _uid is null then
    raise exception 'Sessao expirada. Entre novamente.';
  end if;

  if not public.has_mcf_atendimento_access(_uid) then
    raise exception 'Voce nao tem acesso ao MCF Atendimento.';
  end if;

  if _deal_ids is null or array_length(_deal_ids, 1) is null then
    raise exception 'Selecione pelo menos um negocio.';
  end if;

  _is_lider := public.has_role(_uid, 'admin') or public.has_role(_uid, 'manager');

  if not _is_lider then
    -- operador só dispara para negócios da própria carteira
    select count(*) into _fora
      from public.crm_deals d
     where d.id = any(_deal_ids)
       and coalesce(d.owner_profile_id::text, '') <> _uid::text;

    if _fora > 0 then
      raise exception '% negocios selecionados nao estao na sua carteira. Remova-os da selecao.', _fora;
    end if;

    -- content_sid é NOT NULL; entra vazio porque o template é escolhido
    -- depois, no passo de template do wizard.
    insert into public.wa_broadcasts (criado_por, nome, status, escopo, bu, filtro, content_sid)
    values (_uid, _nome, 'rascunho', 'minha_carteira', null,
            jsonb_build_object('deal_ids', to_jsonb(_deal_ids)), '')
    returning id into _id;

    return _id;
  end if;

  -- liderança: a seleção precisa pertencer a uma única BU
  select array_agg(distinct s) into _bus
    from public.crm_deals d
    join public.profiles p on p.id = d.owner_profile_id
    cross join lateral unnest(coalesce(p.squad, array[]::text[])) as s
   where d.id = any(_deal_ids)
     and nullif(btrim(coalesce(s, '')), '') is not null;

  if _bus is null or array_length(_bus, 1) is null then
    raise exception 'Os donos dos negocios selecionados nao tem BU definida.';
  end if;

  if array_length(_bus, 1) > 1 then
    raise exception 'A selecao mistura mais de uma BU (%). Restrinja a selecao a uma BU so.', array_to_string(_bus, ', ');
  end if;

  insert into public.wa_broadcasts (criado_por, nome, status, escopo, bu, filtro, content_sid)
  values (_uid, _nome, 'rascunho', 'bu', _bus[1],
          jsonb_build_object('deal_ids', to_jsonb(_deal_ids)), '')
  returning id into _id;

  return _id;
end $$;

grant execute on function public.wa_broadcast_estagios_no_escopo(text, text, uuid) to authenticated;
grant execute on function public.wa_broadcast_tags_no_escopo(text, text, uuid) to authenticated;
grant execute on function public.wa_broadcast_criar_de_selecao(text, uuid[]) to authenticated;