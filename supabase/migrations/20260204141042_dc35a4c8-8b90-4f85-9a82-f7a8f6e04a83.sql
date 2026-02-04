-- =============================================
-- SISTEMA DE REPLICAÇÃO DE DEALS CROSS-PIPELINE
-- =============================================

-- 1. Adicionar campos de rastreamento na tabela crm_deals
ALTER TABLE public.crm_deals 
ADD COLUMN IF NOT EXISTS replicated_from_deal_id uuid REFERENCES public.crm_deals(id),
ADD COLUMN IF NOT EXISTS replicated_at timestamp with time zone;

-- Criar índice para rastreamento de replicações
CREATE INDEX IF NOT EXISTS idx_crm_deals_replicated_from ON public.crm_deals(replicated_from_deal_id) WHERE replicated_from_deal_id IS NOT NULL;

-- 2. Criar tabela de regras de replicação
CREATE TABLE IF NOT EXISTS public.deal_replication_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  source_origin_id uuid NOT NULL REFERENCES public.crm_origins(id) ON DELETE CASCADE,
  source_stage_id uuid NOT NULL REFERENCES public.crm_stages(id) ON DELETE CASCADE,
  target_origin_id uuid NOT NULL REFERENCES public.crm_origins(id) ON DELETE CASCADE,
  target_stage_id uuid NOT NULL REFERENCES public.crm_stages(id) ON DELETE CASCADE,
  match_condition jsonb DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  copy_custom_fields boolean NOT NULL DEFAULT true,
  copy_tasks boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  
  -- Evitar regras duplicadas
  CONSTRAINT unique_replication_rule UNIQUE (source_origin_id, source_stage_id, target_origin_id, target_stage_id, match_condition)
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_replication_rules_source ON public.deal_replication_rules(source_origin_id, source_stage_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_replication_rules_active ON public.deal_replication_rules(is_active) WHERE is_active = true;

-- 3. Tabela de log de replicações executadas
CREATE TABLE IF NOT EXISTS public.deal_replication_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id uuid NOT NULL REFERENCES public.deal_replication_rules(id) ON DELETE CASCADE,
  source_deal_id uuid NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  target_deal_id uuid NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  executed_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'success',
  error_message text,
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_replication_logs_source ON public.deal_replication_logs(source_deal_id);
CREATE INDEX IF NOT EXISTS idx_replication_logs_rule ON public.deal_replication_logs(rule_id);

-- 4. Enable RLS
ALTER TABLE public.deal_replication_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_replication_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies para deal_replication_rules
CREATE POLICY "Authenticated users can view replication rules"
ON public.deal_replication_rules
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create replication rules"
ON public.deal_replication_rules
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update replication rules"
ON public.deal_replication_rules
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete replication rules"
ON public.deal_replication_rules
FOR DELETE
TO authenticated
USING (true);

-- 6. RLS Policies para deal_replication_logs
CREATE POLICY "Authenticated users can view replication logs"
ON public.deal_replication_logs
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Service role can insert replication logs"
ON public.deal_replication_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 7. Função de trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_deal_replication_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_deal_replication_rules_updated_at
BEFORE UPDATE ON public.deal_replication_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_deal_replication_rules_updated_at();

-- 8. Função que será chamada via pg_net para processar replicação
CREATE OR REPLACE FUNCTION public.notify_deal_replication()
RETURNS TRIGGER AS $$
DECLARE
  has_rules boolean;
  edge_function_url text;
  service_key text;
BEGIN
  -- Só processa se stage_id mudou e é diferente de null
  IF (TG_OP = 'UPDATE' AND OLD.stage_id IS DISTINCT FROM NEW.stage_id AND NEW.stage_id IS NOT NULL) THEN
    
    -- Ignora se é um deal replicado (evita loops infinitos)
    IF NEW.replicated_from_deal_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
    
    -- Verifica se existe alguma regra ativa para este origin_id e stage_id
    SELECT EXISTS (
      SELECT 1 FROM public.deal_replication_rules 
      WHERE source_origin_id = NEW.origin_id 
        AND source_stage_id = NEW.stage_id 
        AND is_active = true
    ) INTO has_rules;
    
    -- Se existem regras, insere na fila para processamento assíncrono
    IF has_rules THEN
      -- Usar pg_notify para notificar que há trabalho a fazer
      -- A edge function será chamada via webhook ou scheduler
      INSERT INTO public.deal_replication_queue (deal_id, stage_id, origin_id)
      VALUES (NEW.id, NEW.stage_id, NEW.origin_id)
      ON CONFLICT (deal_id, stage_id) DO NOTHING;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 9. Tabela de fila para processamento assíncrono
CREATE TABLE IF NOT EXISTS public.deal_replication_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id uuid NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.crm_stages(id) ON DELETE CASCADE,
  origin_id uuid NOT NULL REFERENCES public.crm_origins(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  
  CONSTRAINT unique_queue_item UNIQUE (deal_id, stage_id)
);

CREATE INDEX IF NOT EXISTS idx_replication_queue_pending ON public.deal_replication_queue(status) WHERE status = 'pending';

-- RLS para queue
ALTER TABLE public.deal_replication_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view replication queue"
ON public.deal_replication_queue
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Service can manage replication queue"
ON public.deal_replication_queue
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 10. Criar trigger no crm_deals
DROP TRIGGER IF EXISTS trigger_deal_replication ON public.crm_deals;
CREATE TRIGGER trigger_deal_replication
AFTER UPDATE OF stage_id ON public.crm_deals
FOR EACH ROW
EXECUTE FUNCTION public.notify_deal_replication();