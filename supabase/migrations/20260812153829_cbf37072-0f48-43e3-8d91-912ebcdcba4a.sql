DROP POLICY IF EXISTS "Service role full access lead_profiles" ON public.lead_profiles;
CREATE POLICY "Service role full access lead_profiles"
  ON public.lead_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);