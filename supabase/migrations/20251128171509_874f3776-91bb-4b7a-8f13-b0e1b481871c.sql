-- Adicionar política RLS pública para crm_contacts (para TV dashboard sem login)
CREATE POLICY "Public read access for TV dashboard"
ON public.crm_contacts
FOR SELECT
TO anon
USING (true);

-- Também adicionar para crm_deals
CREATE POLICY "Public read access for TV dashboard"
ON public.crm_deals
FOR SELECT
TO anon
USING (true);

-- E para deal_activities
CREATE POLICY "Public read access for TV dashboard"
ON public.deal_activities
FOR SELECT
TO anon
USING (true);