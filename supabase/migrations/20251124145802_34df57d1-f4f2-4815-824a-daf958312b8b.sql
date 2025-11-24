-- Criar tabela para logs de webhooks
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Criar índices para performance
CREATE INDEX idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_status ON webhook_events(status);
CREATE INDEX idx_webhook_events_created ON webhook_events(created_at DESC);

-- Habilitar RLS
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins podem ver logs de webhook"
  ON webhook_events
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sistema pode inserir logs de webhook"
  ON webhook_events
  FOR INSERT
  WITH CHECK (true);

-- Comentários
COMMENT ON TABLE webhook_events IS 'Logs de todos os webhooks recebidos do Clint CRM';
COMMENT ON COLUMN webhook_events.event_type IS 'Tipo do evento (ex: contact.created, deal.updated)';
COMMENT ON COLUMN webhook_events.status IS 'Status do processamento: pending, processing, success, error';
COMMENT ON COLUMN webhook_events.processing_time_ms IS 'Tempo de processamento em milissegundos';
