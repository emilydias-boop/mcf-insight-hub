-- Create pipeline_permissions table for controlling group/origin visibility per role
CREATE TABLE public.pipeline_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  group_id UUID REFERENCES crm_groups(id) ON DELETE CASCADE,
  origin_id UUID REFERENCES crm_origins(id) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_pipeline_role_group UNIQUE (role, group_id),
  CONSTRAINT unique_pipeline_role_origin UNIQUE (role, origin_id),
  CONSTRAINT check_group_or_origin CHECK (
    (group_id IS NOT NULL AND origin_id IS NULL) OR 
    (group_id IS NULL AND origin_id IS NOT NULL)
  )
);

-- Enable RLS
ALTER TABLE public.pipeline_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for pipeline_permissions
CREATE POLICY "Admins can manage pipeline permissions"
ON public.pipeline_permissions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Users can view their own role permissions"
ON public.pipeline_permissions
FOR SELECT
USING (
  role = (SELECT ur.role::text FROM user_roles ur WHERE ur.user_id = auth.uid() LIMIT 1)
);

-- Add index for performance
CREATE INDEX idx_pipeline_permissions_role ON public.pipeline_permissions(role);
CREATE INDEX idx_pipeline_permissions_group ON public.pipeline_permissions(group_id);
CREATE INDEX idx_pipeline_permissions_origin ON public.pipeline_permissions(origin_id);

-- Update stage_permissions to use proper UUID references
ALTER TABLE public.stage_permissions 
ADD COLUMN IF NOT EXISTS stage_uuid UUID REFERENCES crm_stages(id) ON DELETE CASCADE;

-- Add index for the new column
CREATE INDEX IF NOT EXISTS idx_stage_permissions_stage_uuid ON public.stage_permissions(stage_uuid);

-- Update timestamp trigger for pipeline_permissions
CREATE TRIGGER update_pipeline_permissions_updated_at
BEFORE UPDATE ON public.pipeline_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();