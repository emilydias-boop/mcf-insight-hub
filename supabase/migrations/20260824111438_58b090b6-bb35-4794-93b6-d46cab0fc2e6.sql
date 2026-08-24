create or replace function public.wa_touch_conversation_from_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_humana boolean;
begin
  -- Determina se a mensagem de saída é humana:
  -- tem sent_by_user_id E o nome NÃO começa com 'Disparo:'.
  -- Mensagens de disparo em massa gravam o sent_by_user_id de quem criou a campanha,
  -- então a checagem do nome é essencial para não contar disparo como atendimento humano.
  -- NÃO remover a condição do 'Disparo:' — sem ela o disparo volta a contar como atendimento.
  v_humana := (
    NEW.direction = 'outbound'
    and NEW.sent_by_user_id is not null
    and coalesce(NEW.sent_by_name, '') not like 'Disparo:%'
  );

  update public.wa_conversations c
    set last_message_at    = now(),
        last_message_preview = left(coalesce(NEW.body_text, NEW.media_caption, ''), 120),
        last_direction      = NEW.direction,
        last_inbound_at     = case when NEW.direction = 'inbound' then now() else c.last_inbound_at end,
        unread_count        = case when NEW.direction = 'inbound' then c.unread_count + 1 else c.unread_count end,
        first_contact_at    = coalesce(c.first_contact_at, case when NEW.direction = 'inbound' then now() else null end),
        status              =
          case
            -- Mensagem recebida: sempre aberta.
            when NEW.direction = 'inbound' then 'aberta'
            -- Saída humana: aguardando cliente.
            when v_humana then 'aguardando_cliente'
            -- A partir daqui é saída automática (disparo/automação/lembrete).
            -- Conversa resolvida é decisão humana: automático não rebaixa.
            when c.status = 'resolvida' then c.status
            -- Saída automática sem nenhum contato real ainda: sem_contato.
            -- ATENÇÃO: a condição NÃO pode depender do status atual.
            -- Conversa nova nasce como 'aberta' na wa_get_or_create_conversation,
            -- então checar status in ('sem_contato','aguardando_cliente')
            -- faz o primeiro disparo cair no else e a conversa ficar 'aberta' para sempre,
            -- reintroduzindo o bug. A condição olha só a ausência de contato real.
            when c.last_inbound_at is null
                 and not exists (
                   select 1 from public.wa_messages m
                    where m.conversation_id = c.id
                      and m.direction = 'outbound'
                      and m.sent_by_user_id is not null
                      and coalesce(m.sent_by_name, '') not like 'Disparo:%'
                 )
              then 'sem_contato'
            -- Saída automática em conversa que já teve contato real: não mexe no status.
            else c.status
          end
  where c.id = NEW.conversation_id;

  return NEW;
end;
$$;

drop trigger if exists trg_wa_touch_conversation_from_message on public.wa_messages;
create trigger trg_wa_touch_conversation_from_message
  after insert on public.wa_messages
  for each row execute function public.wa_touch_conversation_from_message();
