-- Drop existing policy that fails for multi-role users
DROP POLICY IF EXISTS "Users can view their role permissions" ON stage_permissions;

-- Create new policy that supports users with multiple roles
CREATE POLICY "Users can view their role permissions"
ON stage_permissions
FOR SELECT
USING (
  role::text IN (
    SELECT user_roles.role::text 
    FROM user_roles 
    WHERE user_roles.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);