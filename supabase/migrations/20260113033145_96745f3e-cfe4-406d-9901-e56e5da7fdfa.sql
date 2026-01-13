-- Allow managers/admins to delete ONLY manual transactions
CREATE POLICY "Managers can delete manual transactions"
ON public.hubla_transactions
FOR DELETE
TO public
USING (
  source = 'manual'
  AND (
    has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);
