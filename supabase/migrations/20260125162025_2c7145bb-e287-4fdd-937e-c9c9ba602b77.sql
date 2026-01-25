-- Create webhook_endpoints table for incoming webhooks
CREATE TABLE public.webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  
  -- CRM destination
  origin_id UUID REFERENCES public.crm_origins(id) ON DELETE SET NULL,
  stage_id UUID REFERENCES public.crm_stages(id) ON DELETE SET NULL,
  
  -- Automatic tags
  auto_tags TEXT[] DEFAULT '{}',
  
  -- Field mapping (flexible JSON)
  field_mapping JSONB DEFAULT '{}',
  
  -- Validation
  required_fields TEXT[] DEFAULT ARRAY['name', 'email'],
  
  -- Optional authentication headers
  auth_header_name TEXT,
  auth_header_value TEXT,
  
  -- Status and metrics
  is_active BOOLEAN DEFAULT true,
  leads_received INTEGER DEFAULT 0,
  last_lead_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Add comment
COMMENT ON TABLE public.webhook_endpoints IS 'Stores configurations for incoming webhooks that receive leads from external forms';

-- Enable RLS
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users with appropriate roles
CREATE POLICY "webhook_endpoints_select_policy" ON public.webhook_endpoints
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'manager', 'coordenador')
    )
  );

CREATE POLICY "webhook_endpoints_insert_policy" ON public.webhook_endpoints
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'manager', 'coordenador')
    )
  );

CREATE POLICY "webhook_endpoints_update_policy" ON public.webhook_endpoints
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'manager', 'coordenador')
    )
  );

CREATE POLICY "webhook_endpoints_delete_policy" ON public.webhook_endpoints
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'manager', 'coordenador')
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_webhook_endpoints_updated_at
  BEFORE UPDATE ON public.webhook_endpoints
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for faster lookups
CREATE INDEX idx_webhook_endpoints_slug ON public.webhook_endpoints(slug);
CREATE INDEX idx_webhook_endpoints_origin_id ON public.webhook_endpoints(origin_id);
CREATE INDEX idx_webhook_endpoints_is_active ON public.webhook_endpoints(is_active);