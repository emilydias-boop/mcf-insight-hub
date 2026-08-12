DROP POLICY IF EXISTS "Authenticated users can view team targets" ON public.team_targets;
CREATE POLICY "Authenticated users can view team targets"
  ON public.team_targets FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Managers can manage team targets" ON public.team_targets;
CREATE POLICY "Managers can manage team targets"
  ON public.team_targets FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can view weekday target overrides" ON public.team_target_weekday_overrides;
CREATE POLICY "Authenticated users can view weekday target overrides"
  ON public.team_target_weekday_overrides FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Managers can manage weekday target overrides" ON public.team_target_weekday_overrides;
CREATE POLICY "Managers can manage weekday target overrides"
  ON public.team_target_weekday_overrides FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Public read for weekday target overrides on TV" ON public.team_target_weekday_overrides;
CREATE POLICY "Public read for weekday target overrides on TV"
  ON public.team_target_weekday_overrides FOR SELECT TO anon USING (true);