
-- Create a010_link_mappings table
CREATE TABLE public.a010_link_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  offer TEXT NOT NULL,
  origin TEXT NOT NULL,
  channel TEXT NOT NULL,
  match_utm_source TEXT,
  match_utm_campaign TEXT,
  match_utm_medium TEXT,
  match_source TEXT,
  priority INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.a010_link_mappings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can view mappings"
  ON public.a010_link_mappings FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow authenticated users to manage
CREATE POLICY "Authenticated users can insert mappings"
  ON public.a010_link_mappings FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update mappings"
  ON public.a010_link_mappings FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete mappings"
  ON public.a010_link_mappings FOR DELETE
  USING (auth.role() = 'authenticated');

-- Seed initial mappings
INSERT INTO public.a010_link_mappings (name, offer, origin, channel, match_utm_source, priority) VALUES
  ('Facebook Ads (FB)', 'Principal', 'Tráfego Pago', 'Facebook', 'FB', 1),
  ('Facebook Ads (fb)', 'Principal', 'Tráfego Pago', 'Facebook', 'fb', 2),
  ('Instagram Orgânico', 'Principal', 'Instagram Orgânico', 'Instagram', 'ig', 3),
  ('ManyChat', 'Principal', 'Manychat', 'ManyChat', 'manychat', 4),
  ('Orgânico', 'Principal', 'Orgânico', 'Orgânico', 'organic', 5),
  ('Hubla Direto', 'Principal', 'Hubla Direto', 'Hubla', 'hubla', 6);
