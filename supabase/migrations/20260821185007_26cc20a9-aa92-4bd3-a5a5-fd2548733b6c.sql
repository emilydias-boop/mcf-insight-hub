-- PARTE 1: conversas duplicadas de WhatsApp por causa do nono dígito.
-- Contexto: o disparo sai para o número completo (13 dígitos, com nono dígito),
-- mas o WhatsApp devolve o "From" da resposta sem o nono dígito (12 dígitos).
-- A busca em wa_get_or_create_conversation comparava phone_e164 por igualdade
-- exata de string, então a resposta não encontrava a conversa do disparo e
-- criava uma segunda linha. A normalização correta já existe: phone_key_br().

-- 1. Consolidação das duplicatas existentes.
do $$
declare
  _msgs_antes bigint;
  _msgs_depois bigint;
begin
  select count(*) into _msgs_antes from public.wa_messages;

  -- Canônica por grupo: prioriza o telefone no formato completo (13 dígitos,
  -- com o nono dígito) porque é o E.164 correto e é para onde o envio funciona.
  -- Em empate, a conversa mais antiga.
  create temp table _wa_dup on commit drop as
  with grupos as (
    select public.phone_key_br(phone_e164) as k
      from public.wa_conversations
     group by 1
    having count(*) > 1
  ),
  ranqueado as (
    select c.id,
           public.phone_key_br(c.phone_e164) as k,
           row_number() over (
             partition by public.phone_key_br(c.phone_e164)
             order by (length(regexp_replace(c.phone_e164, '\D', '', 'g')) = 13) desc,
                      c.created_at asc,
                      c.id asc
           ) as pos
      from public.wa_conversations c
      join grupos g on g.k = public.phone_key_br(c.phone_e164)
  )
  select r.id as dup_id,
         (select r2.id from ranqueado r2 where r2.k = r.k and r2.pos = 1) as canonica_id
    from ranqueado r
   where r.pos > 1;

  -- Repassa para a canônica os campos que nela estão nulos e existem na duplicata.
  -- last_inbound_at é crítico: controla a janela de 24h, fica o mais recente.
  update public.wa_conversations canon
     set deal_id         = coalesce(canon.deal_id, agg.deal_id),
         contact_name    = coalesce(canon.contact_name, agg.contact_name),
         assigned_to     = coalesce(canon.assigned_to, agg.assigned_to),
         assigned_at     = case when canon.assigned_to is null and agg.assigned_to is not null
                                then agg.assigned_at else canon.assigned_at end,
         assigned_reason = case when canon.assigned_to is null and agg.assigned_to is not null
                                then agg.assigned_reason else canon.assigned_reason end,
         last_inbound_at = greatest(
                             coalesce(canon.last_inbound_at, agg.last_inbound_at),
                             coalesce(agg.last_inbound_at, canon.last_inbound_at)
                           ),
         unread_count    = coalesce(canon.unread_count, 0) + coalesce(agg.unread_count, 0),
         updated_at      = now()
    from (
      select d.canonica_id,
             min(dc.deal_id::text)::uuid          as deal_id,
             min(dc.contact_name)                 as contact_name,
             min(dc.assigned_to::text)::uuid      as assigned_to,
             min(dc.assigned_at)                  as assigned_at,
             min(dc.assigned_reason)              as assigned_reason,
             max(dc.last_inbound_at)              as last_inbound_at,
             sum(coalesce(dc.unread_count, 0))    as unread_count
        from _wa_dup d
        join public.wa_conversations dc on dc.id = d.dup_id
       group by d.canonica_id
    ) agg
   where canon.id = agg.canonica_id;

  -- Move mensagens e alvos de disparo para a canônica antes de apagar.
  update public.wa_messages m
     set conversation_id = d.canonica_id
    from _wa_dup d
   where m.conversation_id = d.dup_id;

  update public.wa_broadcast_targets t
     set conversation_id = d.canonica_id
    from _wa_dup d
   where t.conversation_id = d.dup_id;

  delete from public.wa_conversations c
   using _wa_dup d
   where c.id = d.dup_id;

  -- Recalcula os campos derivados a partir da mensagem mais recente consolidada.
  update public.wa_conversations c
     set last_message_at      = u.created_at,
         last_message_preview = u.preview,
         last_direction       = u.direction,
         updated_at           = now()
    from (
      select distinct on (m.conversation_id)
             m.conversation_id,
             m.created_at,
             left(coalesce(m.body, '[mídia]'), 200) as preview,
             m.direction
        from public.wa_messages m
        join (select distinct canonica_id from _wa_dup) k on k.canonica_id = m.conversation_id
       order by m.conversation_id, m.created_at desc, m.id desc
    ) u
   where c.id = u.conversation_id;

  select count(*) into _msgs_depois from public.wa_messages;
  if _msgs_antes <> _msgs_depois then
    raise exception 'consolidacao perdeu mensagens: antes=% depois=%', _msgs_antes, _msgs_depois;
  end if;
end $$;

-- 2. Localizar por chave normalizada em vez de igualdade exata de string.
create or replace function public.wa_get_or_create_conversation(
  _phone_e164 text,
  _deal_id uuid default null::uuid,
  _contact_name text default null::text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _id uuid;
  _owner uuid;
  _reason text;
begin
  if _phone_e164 is null or btrim(_phone_e164) = '' then
    raise exception 'wa_get_or_create_conversation: phone_e164 obrigatorio';
  end if;

  -- Busca pela chave normalizada: o mesmo número pode chegar com 12 ou 13
  -- dígitos (nono dígito). Prioriza o registro com o formato completo.
  select id into _id
    from public.wa_conversations
   where public.phone_key_br(phone_e164) = public.phone_key_br(_phone_e164)
   order by (length(regexp_replace(phone_e164, '\D', '', 'g')) = 13) desc,
            created_at asc
   limit 1;

  if _id is not null then
    -- Não sobrescreve phone_e164: o formato de 13 dígitos é o bom e não pode
    -- ser rebaixado por uma resposta que chegou com 12.
    update public.wa_conversations
       set deal_id      = coalesce(deal_id, _deal_id),
           contact_name = coalesce(contact_name, _contact_name),
           updated_at   = now()
     where id = _id;

    if _deal_id is not null then
      select profile_id into _owner from public.resolve_deal_owner(_deal_id) limit 1;
      if _owner is not null then
        update public.wa_conversations
           set assigned_to     = coalesce(assigned_to, _owner),
               assigned_at     = case when assigned_to is null then now() else assigned_at end,
               assigned_reason = case when assigned_to is null
                                      then 'resolve_deal_owner na vinculacao'
                                      else assigned_reason end
         where id = _id;
      end if;
    end if;

    return _id;
  end if;

  if _deal_id is not null then
    select profile_id into _owner from public.resolve_deal_owner(_deal_id) limit 1;
    _reason := case when _owner is null
                    then 'sem responsavel resolvido'
                    else 'resolve_deal_owner na criacao' end;
  else
    _reason := 'conversa sem negocio vinculado';
  end if;

  insert into public.wa_conversations (phone_e164, contact_name, deal_id, assigned_to, assigned_at, assigned_reason, status)
  values (_phone_e164, _contact_name, _deal_id, _owner,
          case when _owner is null then null else now() end, _reason, 'aberta')
  on conflict (phone_e164) do update
     set deal_id      = coalesce(public.wa_conversations.deal_id, excluded.deal_id),
         contact_name = coalesce(public.wa_conversations.contact_name, excluded.contact_name),
         updated_at   = now()
  returning id into _id;

  return _id;
end $function$;

-- 3. Proteção contra novas duplicatas na chave normalizada.
-- Mantemos o único em phone_e164 (usado pelo on conflict) e somamos este.
create unique index if not exists uq_wa_conversations_phone_key
  on public.wa_conversations (public.phone_key_br(phone_e164));