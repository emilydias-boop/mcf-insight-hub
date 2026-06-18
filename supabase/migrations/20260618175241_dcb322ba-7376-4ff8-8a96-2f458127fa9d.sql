
-- alertas: restrict INSERT
DROP POLICY IF EXISTS "System can insert alerts" ON public.alertas;
CREATE POLICY "Authenticated users can insert own alerts"
  ON public.alertas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- attendee_movement_logs: SELECT to authenticated
DROP POLICY IF EXISTS "Users can view movement logs" ON public.attendee_movement_logs;
CREATE POLICY "Authenticated users can view movement logs"
  ON public.attendee_movement_logs FOR SELECT TO authenticated
  USING (true);

-- automation_queue: lock writes to service_role
DROP POLICY IF EXISTS "System can insert queue items" ON public.automation_queue;
DROP POLICY IF EXISTS "System can update queue items" ON public.automation_queue;
CREATE POLICY "Service role can insert queue items"
  ON public.automation_queue FOR INSERT TO service_role
  WITH CHECK (true);
CREATE POLICY "Service role can update queue items"
  ON public.automation_queue FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);

-- daily_costs: INSERT to authenticated admin/manager only
DROP POLICY IF EXISTS "System can insert costs" ON public.daily_costs;
CREATE POLICY "Admins and managers can insert costs"
  ON public.daily_costs FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- profiles: TV dashboard policy restricted to authenticated
DROP POLICY IF EXISTS "Public read for TV dashboard" ON public.profiles;
CREATE POLICY "Authenticated read for TV dashboard"
  ON public.profiles FOR SELECT TO authenticated
  USING (show_on_tv = true);

-- r2_status_options: lock writes to admin/coordenador
DROP POLICY IF EXISTS "r2_status_options_insert" ON public.r2_status_options;
DROP POLICY IF EXISTS "r2_status_options_update" ON public.r2_status_options;
DROP POLICY IF EXISTS "r2_status_options_delete" ON public.r2_status_options;
CREATE POLICY "r2_status_options_insert_admin"
  ON public.r2_status_options FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role));
CREATE POLICY "r2_status_options_update_admin"
  ON public.r2_status_options FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role));
CREATE POLICY "r2_status_options_delete_admin"
  ON public.r2_status_options FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role));

-- r2_thermometer_options: same
DROP POLICY IF EXISTS "r2_thermometer_options_insert" ON public.r2_thermometer_options;
DROP POLICY IF EXISTS "r2_thermometer_options_update" ON public.r2_thermometer_options;
DROP POLICY IF EXISTS "r2_thermometer_options_delete" ON public.r2_thermometer_options;
CREATE POLICY "r2_thermometer_options_insert_admin"
  ON public.r2_thermometer_options FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role));
CREATE POLICY "r2_thermometer_options_update_admin"
  ON public.r2_thermometer_options FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role));
CREATE POLICY "r2_thermometer_options_delete_admin"
  ON public.r2_thermometer_options FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role));

-- sdr_payout_audit_log: INSERT to authenticated only
DROP POLICY IF EXISTS "Sistema pode inserir logs" ON public.sdr_payout_audit_log;
CREATE POLICY "Authenticated can insert audit logs"
  ON public.sdr_payout_audit_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- user_notifications: INSERT to authenticated
DROP POLICY IF EXISTS "System can insert notifications" ON public.user_notifications;
CREATE POLICY "Authenticated can insert notifications"
  ON public.user_notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- webhook_events: INSERT to service_role only
DROP POLICY IF EXISTS "Sistema pode inserir logs de webhook" ON public.webhook_events;
CREATE POLICY "Service role can insert webhook events"
  ON public.webhook_events FOR INSERT TO service_role
  WITH CHECK (true);
