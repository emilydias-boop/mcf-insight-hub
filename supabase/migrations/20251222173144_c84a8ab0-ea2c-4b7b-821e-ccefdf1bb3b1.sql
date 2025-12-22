-- Tabela para armazenar instâncias Z-API
CREATE TABLE public.whatsapp_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id TEXT NOT NULL,
  token TEXT NOT NULL,
  client_token TEXT,
  name TEXT NOT NULL DEFAULT 'Principal',
  status TEXT NOT NULL DEFAULT 'disconnected',
  phone_number TEXT,
  connected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tabela para conversas WhatsApp
CREATE TABLE public.whatsapp_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  remote_jid TEXT NOT NULL,
  contact_id UUID REFERENCES public.crm_contacts(id),
  deal_id UUID REFERENCES public.crm_deals(id),
  contact_name TEXT,
  contact_phone TEXT,
  contact_avatar TEXT,
  last_message TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  unread_count INTEGER DEFAULT 0,
  owner_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(instance_id, remote_jid)
);

-- Tabela para mensagens
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  message_id_whatsapp TEXT,
  content TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'outbound',
  status TEXT NOT NULL DEFAULT 'sending',
  sender_id UUID REFERENCES auth.users(id),
  sender_name TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_whatsapp_conversations_contact ON public.whatsapp_conversations(contact_id);
CREATE INDEX idx_whatsapp_conversations_deal ON public.whatsapp_conversations(deal_id);
CREATE INDEX idx_whatsapp_conversations_remote_jid ON public.whatsapp_conversations(remote_jid);
CREATE INDEX idx_whatsapp_messages_conversation ON public.whatsapp_messages(conversation_id);
CREATE INDEX idx_whatsapp_messages_sent_at ON public.whatsapp_messages(sent_at DESC);

-- Trigger para updated_at
CREATE TRIGGER update_whatsapp_instances_updated_at
  BEFORE UPDATE ON public.whatsapp_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_conversations_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para whatsapp_instances
CREATE POLICY "Admins podem gerenciar instâncias"
  ON public.whatsapp_instances
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários autenticados podem visualizar instâncias"
  ON public.whatsapp_instances
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Políticas RLS para whatsapp_conversations
CREATE POLICY "Usuários autenticados podem visualizar conversas"
  ON public.whatsapp_conversations
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "SDRs podem criar conversas"
  ON public.whatsapp_conversations
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "SDRs podem atualizar conversas"
  ON public.whatsapp_conversations
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Políticas RLS para whatsapp_messages
CREATE POLICY "Usuários autenticados podem visualizar mensagens"
  ON public.whatsapp_messages
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários podem enviar mensagens"
  ON public.whatsapp_messages
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários podem atualizar status das mensagens"
  ON public.whatsapp_messages
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Habilitar Realtime para mensagens e conversas
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;

-- REPLICA IDENTITY para Realtime funcionar corretamente
ALTER TABLE public.whatsapp_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_messages REPLICA IDENTITY FULL;

-- Adicionar campo whatsapp_signature na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_signature TEXT;