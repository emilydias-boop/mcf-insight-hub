-- Tabela de logs para webhooks das BUs
CREATE TABLE IF NOT EXISTS bu_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bu_type TEXT NOT NULL, -- 'consorcio', 'credito', 'projetos', 'leilao'
  event_type TEXT,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'received', -- 'received', 'processed', 'error'
  error_message TEXT,
  record_id UUID,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_bu_webhook_logs_bu_type ON bu_webhook_logs(bu_type);
CREATE INDEX idx_bu_webhook_logs_status ON bu_webhook_logs(status);
CREATE INDEX idx_bu_webhook_logs_created_at ON bu_webhook_logs(created_at DESC);

-- RLS (permitir apenas leitura autenticada)
ALTER TABLE bu_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view BU webhook logs"
ON bu_webhook_logs FOR SELECT
TO authenticated
USING (true);