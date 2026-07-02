
-- Campaigns tables
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Campanha do Mês',
  closer_prize TEXT,
  sdr_prize TEXT,
  closer_question TEXT DEFAULT 'Quem vai levar',
  sdr_question TEXT DEFAULT 'Quem vai levar',
  active BOOLEAN NOT NULL DEFAULT true,
  month_ref DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read campaigns" ON public.campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage campaigns" ON public.campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TABLE public.campaign_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('closer','sdr')),
  name TEXT NOT NULL,
  photo_path TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_participants TO authenticated;
GRANT ALL ON public.campaign_participants TO service_role;

ALTER TABLE public.campaign_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read cparts" ON public.campaign_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage cparts" ON public.campaign_participants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for campaign-photos bucket (private) - authenticated read/write
CREATE POLICY "auth read campaign photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'campaign-photos');

CREATE POLICY "auth upload campaign photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'campaign-photos');

CREATE POLICY "auth update campaign photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'campaign-photos');

CREATE POLICY "auth delete campaign photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'campaign-photos');
