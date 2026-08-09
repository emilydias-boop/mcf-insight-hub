CREATE TABLE public.sonax_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sonax_campaign_id TEXT,
  descricao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativa',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sonax_campaigns TO authenticated;
GRANT ALL ON public.sonax_campaigns TO service_role;
ALTER TABLE public.sonax_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sonax campaigns" ON public.sonax_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create sonax campaigns" ON public.sonax_campaigns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update sonax campaigns" ON public.sonax_campaigns FOR UPDATE TO authenticated USING (true);

CREATE TABLE public.sonax_campaign_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.sonax_campaigns(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  contact_phone TEXT,
  sonax_id_contato_campanha TEXT,
  tabulacao TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  added_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sonax_campaign_contacts TO authenticated;
GRANT ALL ON public.sonax_campaign_contacts TO service_role;
ALTER TABLE public.sonax_campaign_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sonax campaign contacts" ON public.sonax_campaign_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create sonax campaign contacts" ON public.sonax_campaign_contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update sonax campaign contacts" ON public.sonax_campaign_contacts FOR UPDATE TO authenticated USING (true);

CREATE INDEX idx_sonax_campaign_contacts_campaign ON public.sonax_campaign_contacts(campaign_id);
CREATE INDEX idx_sonax_campaigns_created_at ON public.sonax_campaigns(created_at DESC);

CREATE TRIGGER update_sonax_campaigns_updated_at BEFORE UPDATE ON public.sonax_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sonax_campaign_contacts_updated_at BEFORE UPDATE ON public.sonax_campaign_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();