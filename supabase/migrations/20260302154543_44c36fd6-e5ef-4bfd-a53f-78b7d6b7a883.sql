
-- Add bu column to role_permissions
ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS bu TEXT DEFAULT NULL;

-- Drop old unique constraint first (this also drops the underlying index)
ALTER TABLE public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_resource_key;

-- Create new unique index that includes bu
CREATE UNIQUE INDEX role_permissions_role_resource_bu_key 
  ON public.role_permissions (role, resource, COALESCE(bu, '__global__'));
