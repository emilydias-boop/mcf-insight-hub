CREATE OR REPLACE FUNCTION public.wa_broadcast_criar_de_selecao(_nome text, _deal_ids uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    -- O público é montado JÁ NA CRIAÇÃO: o recorte de quem recebe foi feito pela
    -- pessoa no CRM, então não há nada a filtrar. Nascer com zero alvos obrigava
    -- a passar pelo passo de filtro do wizard, que era exatamente onde a seleção
    -- se perdia. As variáveis (nome) são preenchidas depois, quando o template
    -- for escolhido: com content_sid vazio a wa_broadcast_preencher_variaveis
    -- sai cedo e devolve 0 sem erro.
    perform public.wa_broadcast_montar_publico(_id);

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

  -- mesma razão do ramo do operador: público pronto na criação
  perform public.wa_broadcast_montar_publico(_id);

  return _id;
end $function$;