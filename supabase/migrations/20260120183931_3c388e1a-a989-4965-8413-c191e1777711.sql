-- Drop existing INSERT policy on deal_tasks
DROP POLICY IF EXISTS "Admins and coordenadores can create tasks" ON deal_tasks;

-- Create new INSERT policy that includes sdr and closer roles
CREATE POLICY "Allow authorized roles to create tasks"
ON deal_tasks FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'coordenador'::app_role)
  OR has_role(auth.uid(), 'sdr'::app_role)
  OR has_role(auth.uid(), 'closer'::app_role)
);