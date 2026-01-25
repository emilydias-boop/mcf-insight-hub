-- Tabela para configuração de webhooks de saída
CREATE TABLE webhook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Contexto (associado a uma origem/pipeline)
  origin_id UUID REFERENCES crm_origins(id) ON DELETE CASCADE,
  
  -- Configuração básica
  name TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  method TEXT DEFAULT 'POST' CHECK (method IN ('POST', 'PUT', 'PATCH')),
  headers JSONB DEFAULT '{}',
  
  -- Eventos que disparam o webhook
  events TEXT[] NOT NULL DEFAULT '{}',
  -- Valores possíveis: 'deal.created', 'deal.updated', 'deal.stage_changed', 
  --                    'deal.won', 'deal.lost', 'contact.created', 'contact.updated'
  
  -- Filtros opcionais
  stage_ids UUID[] DEFAULT NULL,  -- Se preenchido, só dispara para essas etapas
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Estatísticas
  last_triggered_at TIMESTAMPTZ,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índices para performance
CREATE INDEX idx_webhook_configs_origin ON webhook_configs(origin_id) WHERE origin_id IS NOT NULL;
CREATE INDEX idx_webhook_configs_active ON webhook_configs(is_active) WHERE is_active = true;
CREATE INDEX idx_webhook_configs_events ON webhook_configs USING GIN(events);

-- Enable RLS
ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - todos os usuários autenticados podem ver e gerenciar webhooks
CREATE POLICY "Authenticated users can view webhook configs"
ON webhook_configs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create webhook configs"
ON webhook_configs FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update webhook configs"
ON webhook_configs FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete webhook configs"
ON webhook_configs FOR DELETE
TO authenticated
USING (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_webhook_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_webhook_configs_updated_at
BEFORE UPDATE ON webhook_configs
FOR EACH ROW
EXECUTE FUNCTION update_webhook_configs_updated_at();