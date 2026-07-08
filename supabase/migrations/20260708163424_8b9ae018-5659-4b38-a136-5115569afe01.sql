
-- 1) Tabela de acesso ao MCF Atendimento
CREATE TABLE public.mcf_atendimento_access (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcf_atendimento_access TO authenticated;
GRANT ALL ON public.mcf_atendimento_access TO service_role;

ALTER TABLE public.mcf_atendimento_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/manager gerencia acesso"
  ON public.mcf_atendimento_access FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Usuario ve seu proprio acesso"
  ON public.mcf_atendimento_access FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 2) Função helper para checar acesso ao canal
CREATE OR REPLACE FUNCTION public.has_mcf_atendimento_access(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR public.has_role(_user_id, 'manager')
    OR EXISTS (SELECT 1 FROM public.mcf_atendimento_access WHERE user_id = _user_id);
$$;

-- 3) Conversations
CREATE TABLE public.wa_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  deal_id UUID REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  last_direction TEXT CHECK (last_direction IN ('inbound','outbound')),
  unread_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_conversations_last_msg ON public.wa_conversations(last_message_at DESC NULLS LAST);
CREATE INDEX idx_wa_conversations_phone ON public.wa_conversations(phone_e164);

GRANT SELECT, INSERT, UPDATE ON public.wa_conversations TO authenticated;
GRANT ALL ON public.wa_conversations TO service_role;

ALTER TABLE public.wa_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "MCF Atendimento pode ler conversas"
  ON public.wa_conversations FOR SELECT TO authenticated
  USING (public.has_mcf_atendimento_access(auth.uid()));

CREATE POLICY "MCF Atendimento pode criar conversas"
  ON public.wa_conversations FOR INSERT TO authenticated
  WITH CHECK (public.has_mcf_atendimento_access(auth.uid()));

CREATE POLICY "MCF Atendimento pode atualizar conversas"
  ON public.wa_conversations FOR UPDATE TO authenticated
  USING (public.has_mcf_atendimento_access(auth.uid()))
  WITH CHECK (public.has_mcf_atendimento_access(auth.uid()));

-- 4) Messages
CREATE TABLE public.wa_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.wa_conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  body TEXT NOT NULL,
  twilio_message_sid TEXT UNIQUE,
  sent_by_user_id UUID REFERENCES auth.users(id),
  sent_by_name TEXT,
  status TEXT DEFAULT 'sent',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_messages_conv ON public.wa_messages(conversation_id, created_at);

GRANT SELECT, INSERT ON public.wa_messages TO authenticated;
GRANT ALL ON public.wa_messages TO service_role;

ALTER TABLE public.wa_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "MCF Atendimento pode ler mensagens"
  ON public.wa_messages FOR SELECT TO authenticated
  USING (public.has_mcf_atendimento_access(auth.uid()));

CREATE POLICY "MCF Atendimento pode inserir mensagens"
  ON public.wa_messages FOR INSERT TO authenticated
  WITH CHECK (public.has_mcf_atendimento_access(auth.uid()));

-- 5) Trigger updated_at
CREATE OR REPLACE FUNCTION public.wa_conversations_touch()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_wa_conversations_touch
  BEFORE UPDATE ON public.wa_conversations
  FOR EACH ROW EXECUTE FUNCTION public.wa_conversations_touch();

-- 6) Realtime
ALTER TABLE public.wa_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.wa_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_messages;
