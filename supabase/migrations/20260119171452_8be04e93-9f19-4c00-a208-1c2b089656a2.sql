-- Create table for qualification field configurations
CREATE TABLE public.qualification_field_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'group', 'origin')),
  group_id UUID REFERENCES public.crm_groups(id) ON DELETE CASCADE,
  origin_id UUID REFERENCES public.crm_origins(id) ON DELETE CASCADE,
  fields JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_scope CHECK (
    (scope_type = 'global' AND group_id IS NULL AND origin_id IS NULL) OR
    (scope_type = 'group' AND group_id IS NOT NULL AND origin_id IS NULL) OR
    (scope_type = 'origin' AND origin_id IS NOT NULL)
  )
);

-- Create unique constraints to prevent duplicate configs
CREATE UNIQUE INDEX qualification_field_configs_global_unique 
  ON public.qualification_field_configs (scope_type) 
  WHERE scope_type = 'global';

CREATE UNIQUE INDEX qualification_field_configs_group_unique 
  ON public.qualification_field_configs (group_id) 
  WHERE scope_type = 'group';

CREATE UNIQUE INDEX qualification_field_configs_origin_unique 
  ON public.qualification_field_configs (origin_id) 
  WHERE scope_type = 'origin';

-- Enable RLS
ALTER TABLE public.qualification_field_configs ENABLE ROW LEVEL SECURITY;

-- Policy: Admins, managers and coordinators can manage configs
CREATE POLICY "Admins e managers podem gerenciar configs" 
  ON public.qualification_field_configs
  FOR ALL 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager', 'coordenador')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager', 'coordenador')
    )
  );

-- Policy: All authenticated users can read configs
CREATE POLICY "Todos podem ler configs" 
  ON public.qualification_field_configs
  FOR SELECT 
  TO authenticated
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_qualification_field_configs_updated_at
  BEFORE UPDATE ON public.qualification_field_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();