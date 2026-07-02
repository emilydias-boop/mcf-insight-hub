
GRANT SELECT ON public.campaigns TO anon;
GRANT SELECT ON public.campaign_participants TO anon;
DROP POLICY IF EXISTS "public read active campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "public read cparts of active" ON public.campaign_participants;
CREATE POLICY "public read active campaigns" ON public.campaigns FOR SELECT TO anon USING (active = true);
CREATE POLICY "public read cparts of active" ON public.campaign_participants FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.active = true));
