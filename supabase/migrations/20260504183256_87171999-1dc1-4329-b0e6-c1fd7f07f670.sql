
DROP POLICY IF EXISTS "Public read access for TV dashboard" ON public.crm_contacts;
DROP POLICY IF EXISTS "Public read access for TV dashboard" ON public.crm_deals;
DROP POLICY IF EXISTS "Public read access for TV dashboard" ON public.deal_activities;
DROP POLICY IF EXISTS "Public read access for TV dashboard" ON public.hubla_transactions;
DROP POLICY IF EXISTS "Todos podem visualizar webhook_events" ON public.webhook_events;

DROP POLICY IF EXISTS "Todos podem visualizar negócios" ON public.crm_deals;
CREATE POLICY "Authenticated can view crm_deals"
  ON public.crm_deals FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can view activities" ON public.deal_activities;
CREATE POLICY "Authenticated can view activities"
  ON public.deal_activities FOR SELECT TO authenticated USING (true);
