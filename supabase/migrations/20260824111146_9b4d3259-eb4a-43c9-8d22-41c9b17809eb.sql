-- 1) Novo status permitido: 'sem_contato'
ALTER TABLE public.wa_conversations DROP CONSTRAINT IF EXISTS wa_conversations_status_check;
ALTER TABLE public.wa_conversations
  ADD CONSTRAINT wa_conversations_status_check
  CHECK (status = ANY (ARRAY['aberta'::text, 'aguardando_cliente'::text, 'resolvida'::text, 'sem_contato'::text]));

-- 2) Trigger: saída automática não marca mais 'aguardando_cliente'
-- REGRA DO 'Disparo:' — NÃO SIMPLIFICAR:
-- as mensagens de disparo em massa gravam sent_by_user_id de quem criou a campanha.
-- Portanto, mensagem humana = sent_by_user_id IS NOT NULL **E** sent_by_name NÃO começa com 'Disparo:'.
-- Sem a segunda condição um disparo em massa passaria por atendimento humano.
-- Automação e lembrete têm sent_by_user_id nulo e já ficam de fora.
CREATE OR REPLACE FUNCTION public.wa_touch_conversation_from_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_humana boolean;
begin
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
                                  -- lead respondeu: conversa aberta
                                  when new.direction = 'inbound' then 'aberta'
                                  -- pessoa do time escreveu: aguardando cliente
                                  when v_humana then 'aguardando_cliente'
                                  -- saída automática em conversa sem contato real: sem_contato
                                  when c.last_inbound_at is null
                                       and c.status in ('sem_contato', 'aguardando_cliente')
                                       and not exists (
                                         select 1 from public.wa_messages m
                                          where m.conversation_id = c.id
                                            and m.direction = 'outbound'
                                            and m.sent_by_user_id is not null
                                            and coalesce(m.sent_by_name, '') not like 'Disparo:%'
                                       )
                                    then 'sem_contato'
                                  -- saída automática em conversa com contato real: não mexe
                                  else c.status
                                end,
         updated_at           = now()
   where c.id = new.conversation_id;
  return new;
end $function$;

-- 3) Backfill: conversas que nunca receberam inbound nem mensagem humana
UPDATE public.wa_conversations c
   SET status = 'sem_contato', updated_at = now()
 WHERE c.status <> 'sem_contato'
   AND NOT EXISTS (
     SELECT 1 FROM public.wa_messages m
      WHERE m.conversation_id = c.id
        AND m.direction = 'inbound'
   )
   AND NOT EXISTS (
     SELECT 1 FROM public.wa_messages m
      WHERE m.conversation_id = c.id
        AND m.direction = 'outbound'
        AND m.sent_by_user_id IS NOT NULL
        AND coalesce(m.sent_by_name, '') NOT LIKE 'Disparo:%'
   );
