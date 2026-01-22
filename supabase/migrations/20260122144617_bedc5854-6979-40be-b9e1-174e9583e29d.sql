-- Tabela de configuração de distribuição de leads
CREATE TABLE public.lead_distribution_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_id UUID NOT NULL REFERENCES crm_origins(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  user_name TEXT,
  percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  current_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(origin_id, user_email)
);

-- Índices para performance
CREATE INDEX idx_lead_distribution_origin ON lead_distribution_config(origin_id);
CREATE INDEX idx_lead_distribution_user ON lead_distribution_config(user_email);

-- Enable RLS
ALTER TABLE lead_distribution_config ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Anyone can view distribution config"
ON lead_distribution_config FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins and managers can insert distribution config"
ON lead_distribution_config FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
);

CREATE POLICY "Only admins and managers can update distribution config"
ON lead_distribution_config FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
);

CREATE POLICY "Only admins and managers can delete distribution config"
ON lead_distribution_config FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_lead_distribution_config_updated_at
  BEFORE UPDATE ON lead_distribution_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Função para obter próximo owner baseado na distribuição
CREATE OR REPLACE FUNCTION get_next_lead_owner(p_origin_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_owner TEXT;
BEGIN
  -- Busca o usuário ativo com menor proporção de leads recebidos vs percentual
  SELECT user_email INTO next_owner
  FROM lead_distribution_config
  WHERE origin_id = p_origin_id
    AND is_active = true
    AND percentage > 0
  ORDER BY (current_count::NUMERIC / NULLIF(percentage, 0)) ASC, random()
  LIMIT 1;
  
  -- Incrementa o contador do usuário selecionado
  IF next_owner IS NOT NULL THEN
    UPDATE lead_distribution_config
    SET current_count = current_count + 1,
        updated_at = now()
    WHERE origin_id = p_origin_id 
      AND user_email = next_owner;
  END IF;
  
  RETURN next_owner;
END;
$$;

-- Função para resetar contadores de distribuição
CREATE OR REPLACE FUNCTION reset_distribution_counters(p_origin_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE lead_distribution_config
  SET current_count = 0,
      updated_at = now()
  WHERE origin_id = p_origin_id;
END;
$$;