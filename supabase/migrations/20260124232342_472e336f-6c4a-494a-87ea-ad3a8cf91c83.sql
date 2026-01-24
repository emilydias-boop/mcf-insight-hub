-- Enum para canais de automação
CREATE TYPE automation_channel AS ENUM ('whatsapp', 'email', 'sms');

-- Enum para status de envio
CREATE TYPE automation_status AS ENUM ('pending', 'processing', 'sent', 'delivered', 'read', 'replied', 'failed', 'cancelled');

-- Enum para trigger de fluxo
CREATE TYPE automation_trigger AS ENUM ('enter', 'exit');

-- Tabela de templates de mensagens
CREATE TABLE automation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  channel automation_channel NOT NULL,
  subject TEXT, -- Só para email
  content TEXT NOT NULL,
  variables TEXT[] DEFAULT ARRAY['nome', 'sdr', 'data', 'link', 'produto'],
  twilio_template_sid TEXT, -- SID do template aprovado no WhatsApp
  activecampaign_template_id TEXT, -- ID do template na ActiveCampaign
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de fluxos de automação
CREATE TABLE automation_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  stage_id UUID REFERENCES crm_stages(id) ON DELETE CASCADE,
  origin_id UUID REFERENCES crm_origins(id) ON DELETE SET NULL,
  trigger_on automation_trigger DEFAULT 'enter',
  is_active BOOLEAN DEFAULT true,
  respect_business_hours BOOLEAN DEFAULT true,
  business_hours_start TIME DEFAULT '09:00',
  business_hours_end TIME DEFAULT '18:00',
  exclude_weekends BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de passos de cada fluxo
CREATE TABLE automation_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID REFERENCES automation_flows(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES automation_templates(id) ON DELETE RESTRICT NOT NULL,
  channel automation_channel NOT NULL,
  delay_days INTEGER DEFAULT 0,
  delay_hours INTEGER DEFAULT 0,
  delay_minutes INTEGER DEFAULT 0,
  order_index INTEGER DEFAULT 0,
  conditions JSONB DEFAULT '{}', -- Ex: {"only_if_no_reply": true}
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de fila de envios agendados
CREATE TABLE automation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES crm_deals(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE CASCADE,
  step_id UUID REFERENCES automation_steps(id) ON DELETE CASCADE NOT NULL,
  flow_id UUID REFERENCES automation_flows(id) ON DELETE CASCADE NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status automation_status DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de logs de envio (histórico completo)
CREATE TABLE automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES crm_deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  flow_id UUID REFERENCES automation_flows(id) ON DELETE SET NULL,
  step_id UUID REFERENCES automation_steps(id) ON DELETE SET NULL,
  template_id UUID REFERENCES automation_templates(id) ON DELETE SET NULL,
  channel automation_channel NOT NULL,
  recipient TEXT NOT NULL, -- Número ou email
  content_sent TEXT, -- Mensagem enviada (com variáveis substituídas)
  status automation_status NOT NULL,
  external_id TEXT, -- ID do Twilio ou ActiveCampaign
  external_status TEXT, -- Status retornado pela API
  metadata JSONB DEFAULT '{}',
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de configurações gerais de automação
CREATE TABLE automation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de blacklist (leads que pediram para sair)
CREATE TABLE automation_blacklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE CASCADE,
  phone TEXT,
  email TEXT,
  channel automation_channel,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT blacklist_has_identifier CHECK (phone IS NOT NULL OR email IS NOT NULL OR contact_id IS NOT NULL)
);

-- Índices para performance
CREATE INDEX idx_automation_queue_scheduled ON automation_queue(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_automation_queue_deal ON automation_queue(deal_id);
CREATE INDEX idx_automation_queue_status ON automation_queue(status);
CREATE INDEX idx_automation_logs_deal ON automation_logs(deal_id);
CREATE INDEX idx_automation_logs_contact ON automation_logs(contact_id);
CREATE INDEX idx_automation_logs_created ON automation_logs(created_at DESC);
CREATE INDEX idx_automation_flows_stage ON automation_flows(stage_id) WHERE is_active = true;
CREATE INDEX idx_automation_blacklist_phone ON automation_blacklist(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_automation_blacklist_email ON automation_blacklist(email) WHERE email IS NOT NULL;

-- Enable RLS
ALTER TABLE automation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_blacklist ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Apenas admins podem gerenciar

-- Templates
CREATE POLICY "Admins can manage automation_templates"
ON automation_templates FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can view active templates"
ON automation_templates FOR SELECT
USING (auth.uid() IS NOT NULL AND is_active = true);

-- Flows
CREATE POLICY "Admins can manage automation_flows"
ON automation_flows FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Coordenadores can view flows"
ON automation_flows FOR SELECT
USING (has_role(auth.uid(), 'coordenador'));

-- Steps
CREATE POLICY "Admins can manage automation_steps"
ON automation_steps FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Coordenadores can view steps"
ON automation_steps FOR SELECT
USING (has_role(auth.uid(), 'coordenador'));

-- Queue
CREATE POLICY "Admins can manage automation_queue"
ON automation_queue FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert queue items"
ON automation_queue FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update queue items"
ON automation_queue FOR UPDATE
USING (true);

-- Logs
CREATE POLICY "Admins can view all automation_logs"
ON automation_logs FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador'));

CREATE POLICY "System can insert logs"
ON automation_logs FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update logs"
ON automation_logs FOR UPDATE
USING (true);

-- Settings
CREATE POLICY "Admins can manage automation_settings"
ON automation_settings FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Blacklist
CREATE POLICY "Admins can manage automation_blacklist"
ON automation_blacklist FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert blacklist"
ON automation_blacklist FOR INSERT
WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_automation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_automation_templates_updated_at
  BEFORE UPDATE ON automation_templates
  FOR EACH ROW EXECUTE FUNCTION update_automation_updated_at();

CREATE TRIGGER update_automation_flows_updated_at
  BEFORE UPDATE ON automation_flows
  FOR EACH ROW EXECUTE FUNCTION update_automation_updated_at();

CREATE TRIGGER update_automation_steps_updated_at
  BEFORE UPDATE ON automation_steps
  FOR EACH ROW EXECUTE FUNCTION update_automation_updated_at();

-- Inserir configurações padrão
INSERT INTO automation_settings (key, value, description) VALUES
  ('twilio_whatsapp_enabled', 'false', 'Habilitar envio de WhatsApp via Twilio'),
  ('activecampaign_enabled', 'false', 'Habilitar envio de email via ActiveCampaign'),
  ('max_retries', '3', 'Número máximo de tentativas de envio'),
  ('retry_delay_minutes', '30', 'Tempo entre tentativas de reenvio'),
  ('default_business_hours', '{"start": "09:00", "end": "18:00", "timezone": "America/Sao_Paulo"}', 'Horário comercial padrão');

-- Comentários nas tabelas
COMMENT ON TABLE automation_templates IS 'Templates de mensagens para automação (WhatsApp e Email)';
COMMENT ON TABLE automation_flows IS 'Fluxos de automação configurados por stage do CRM';
COMMENT ON TABLE automation_steps IS 'Passos/etapas de cada fluxo de automação';
COMMENT ON TABLE automation_queue IS 'Fila de mensagens agendadas para envio';
COMMENT ON TABLE automation_logs IS 'Histórico completo de todas as mensagens enviadas';
COMMENT ON TABLE automation_settings IS 'Configurações gerais do sistema de automação';
COMMENT ON TABLE automation_blacklist IS 'Contatos que optaram por não receber mensagens';