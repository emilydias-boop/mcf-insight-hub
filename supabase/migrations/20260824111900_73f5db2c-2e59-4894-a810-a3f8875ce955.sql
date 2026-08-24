CREATE OR REPLACE FUNCTION public.wa_touch_conversation_from_message()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_humana boolean;
begin
  -- Humana = tem usuario E o nome nao comeca com 'Disparo:'.
  -- Disparo em massa grava o sent_by_user_id de quem criou a campanha,
  -- entao sem a checagem do nome o disparo contaria como atendimento.
  v_humana := new.direction = 'outbound'
              and new.sent_by_user_id is not null
              and coalesce(new.sent_by_name, '') not like 'Disparo:%';

  update public.wa_conversations c
     set last_message_at      = new.created_at,
         last_message_preview = left(coalesce(new.body, ''), 200),
         last_direction       = new.direction,
         last_inbound_at      = case when new.direction = 'inbound'
                                     then new.created_at else c.last_inbound_at end,
         unread_count         = case when new.direction = 'inbound'
                                     then coalesce(c.unread_count, 0) + 1 else c.unread_count end,
         first_contact_at     = coalesce(c.first_contact_at, new.created_at),
         status               = case
                                  when new.direction = 'inbound' then 'aberta'
                                  when v_humana then 'aguardando_cliente'
                                  -- resolvida e decisao humana: automatico nao rebaixa
                                  when c.status = 'resolvida' then c.status
                                  -- ATENCAO: nao condicionar ao status atual. Conversa nova
                                  -- nasce 'aberta' e isso reintroduz o bug do disparo.
                                  when c.last_inbound_at is null
                                       and not exists (
                                         select 1 from public.wa_messages m
                                          where m.conversation_id = c.id
                                            and m.direction = 'outbound'
                                            and m.sent_by_user_id is not null
                                            and coalesce(m.sent_by_name, '') not like 'Disparo:%'
                                       )
                                    then 'sem_contato'
                                  else c.status
                                end,
         updated_at           = now()
   where c.id = new.conversation_id;
  return new;
end $function$;

DROP TRIGGER IF EXISTS trg_wa_touch_conversation_from_message ON public.wa_messages;