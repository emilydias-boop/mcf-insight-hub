-- Create table for closer meeting links by day and time
CREATE TABLE public.closer_meeting_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closer_id UUID NOT NULL REFERENCES closers(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  google_meet_link TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(closer_id, day_of_week, start_time)
);

-- Enable RLS
ALTER TABLE public.closer_meeting_links ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read
CREATE POLICY "Allow read for authenticated" ON public.closer_meeting_links
  FOR SELECT USING (auth.role() = 'authenticated');

-- Insert Julio's links (ID: 697b1c04-6dd0-4955-8f33-2e0bcfaad007)
-- Segunda (day_of_week = 1)
INSERT INTO public.closer_meeting_links (closer_id, day_of_week, start_time, google_meet_link) VALUES
('697b1c04-6dd0-4955-8f33-2e0bcfaad007', 1, '13:30:00', 'https://meet.google.com/ahe-qvgv-wxe'),
('697b1c04-6dd0-4955-8f33-2e0bcfaad007', 1, '14:45:00', 'https://meet.google.com/nev-hcvw-kmt'),
('697b1c04-6dd0-4955-8f33-2e0bcfaad007', 1, '16:00:00', 'https://meet.google.com/ahe-qvgv-wxe'),
('697b1c04-6dd0-4955-8f33-2e0bcfaad007', 1, '18:00:00', 'https://meet.google.com/nev-hcvw-kmt'),
('697b1c04-6dd0-4955-8f33-2e0bcfaad007', 1, '19:15:00', 'https://meet.google.com/nev-hcvw-kmt'),
('697b1c04-6dd0-4955-8f33-2e0bcfaad007', 1, '20:30:00', 'https://meet.google.com/ahe-qvgv-wxe'),
-- Terça (day_of_week = 2)
('697b1c04-6dd0-4955-8f33-2e0bcfaad007', 2, '09:00:00', 'https://meet.google.com/ahe-qvgv-wxe'),
('697b1c04-6dd0-4955-8f33-2e0bcfaad007', 2, '10:15:00', 'https://meet.google.com/npq-uirx-ecg'),
('697b1c04-6dd0-4955-8f33-2e0bcfaad007', 2, '11:30:00', 'https://meet.google.com/ahe-qvgv-wxe'),
('697b1c04-6dd0-4955-8f33-2e0bcfaad007', 2, '12:45:00', 'https://meet.google.com/nev-hcvw-kmt'),
('697b1c04-6dd0-4955-8f33-2e0bcfaad007', 2, '14:00:00', 'https://meet.google.com/npq-uirx-ecg'),
('697b1c04-6dd0-4955-8f33-2e0bcfaad007', 2, '16:00:00', 'https://meet.google.com/ahe-qvgv-wxe'),
-- Quarta (day_of_week = 3)
('697b1c04-6dd0-4955-8f33-2e0bcfaad007', 3, '13:30:00', 'https://meet.google.com/ahe-qvgv-wxe'),
('697b1c04-6dd0-4955-8f33-2e0bcfaad007', 3, '14:45:00', 'https://meet.google.com/ahe-qvgv-wxe'),
('697b1c04-6dd0-4955-8f33-2e0bcfaad007', 3, '16:00:00', 'https://meet.google.com/ahe-qvgv-wxe'),
('697b1c04-6dd0-4955-8f33-2e0bcfaad007', 3, '18:00:00', 'https://meet.google.com/nev-hcvw-kmt'),
('697b1c04-6dd0-4955-8f33-2e0bcfaad007', 3, '19:15:00', 'https://meet.google.com/npq-uirx-ecg'),
('697b1c04-6dd0-4955-8f33-2e0bcfaad007', 3, '20:30:00', 'https://meet.google.com/ahe-qvgv-wxe'),
-- Quinta (day_of_week = 4)
('697b1c04-6dd0-4955-8f33-2e0bcfaad007', 4, '13:30:00', 'https://meet.google.com/ahe-qvgv-wxe'),
('697b1c04-6dd0-4955-8f33-2e0bcfaad007', 4, '14:45:00', 'https://meet.google.com/nev-hcvw-kmt'),
('697b1c04-6dd0-4955-8f33-2e0bcfaad007', 4, '16:00:00', 'https://meet.google.com/ahe-qvgv-wxe'),
('697b1c04-6dd0-4955-8f33-2e0bcfaad007', 4, '18:00:00', 'https://meet.google.com/nev-hcvw-kmt'),
('697b1c04-6dd0-4955-8f33-2e0bcfaad007', 4, '19:15:00', 'https://meet.google.com/nev-hcvw-kmt'),
('697b1c04-6dd0-4955-8f33-2e0bcfaad007', 4, '20:30:00', 'https://meet.google.com/ahe-qvgv-wxe'),
-- Sábado (day_of_week = 6)
('697b1c04-6dd0-4955-8f33-2e0bcfaad007', 6, '09:00:00', 'https://meet.google.com/itw-asvz-rus'),
('697b1c04-6dd0-4955-8f33-2e0bcfaad007', 6, '10:15:00', 'https://meet.google.com/nev-hcvw-kmt'),
('697b1c04-6dd0-4955-8f33-2e0bcfaad007', 6, '11:30:00', 'https://meet.google.com/itw-asvz-rus'),
('697b1c04-6dd0-4955-8f33-2e0bcfaad007', 6, '12:45:00', 'https://meet.google.com/hkd-vmcw-vmj'),
('697b1c04-6dd0-4955-8f33-2e0bcfaad007', 6, '14:00:00', 'https://meet.google.com/itw-asvz-rus');

-- Insert Thayna's links (ID: 1c10697f-2456-48ff-bbdb-ee6cbe5f4e4a)
-- Terça (day_of_week = 2)
INSERT INTO public.closer_meeting_links (closer_id, day_of_week, start_time, google_meet_link) VALUES
('1c10697f-2456-48ff-bbdb-ee6cbe5f4e4a', 2, '09:00:00', 'https://meet.google.com/icn-zdoj-oqn'),
('1c10697f-2456-48ff-bbdb-ee6cbe5f4e4a', 2, '10:15:00', 'https://meet.google.com/bbd-tfmr-cwg'),
('1c10697f-2456-48ff-bbdb-ee6cbe5f4e4a', 2, '11:30:00', 'https://meet.google.com/icn-zdoj-oqn'),
('1c10697f-2456-48ff-bbdb-ee6cbe5f4e4a', 2, '14:00:00', 'https://meet.google.com/bbd-tfmr-cwg'),
('1c10697f-2456-48ff-bbdb-ee6cbe5f4e4a', 2, '16:00:00', 'https://meet.google.com/icn-zdoj-oqn'),
('1c10697f-2456-48ff-bbdb-ee6cbe5f4e4a', 2, '17:15:00', 'https://meet.google.com/bbd-tfmr-cwg'),
('1c10697f-2456-48ff-bbdb-ee6cbe5f4e4a', 2, '18:15:00', 'https://meet.google.com/icn-zdoj-oqn'),
-- Quarta (day_of_week = 3)
('1c10697f-2456-48ff-bbdb-ee6cbe5f4e4a', 3, '09:00:00', 'https://meet.google.com/icn-zdoj-oqn'),
('1c10697f-2456-48ff-bbdb-ee6cbe5f4e4a', 3, '10:15:00', 'https://meet.google.com/bbd-tfmr-cwg'),
('1c10697f-2456-48ff-bbdb-ee6cbe5f4e4a', 3, '11:30:00', 'https://meet.google.com/icn-zdoj-oqn'),
('1c10697f-2456-48ff-bbdb-ee6cbe5f4e4a', 3, '14:00:00', 'https://meet.google.com/bbd-tfmr-cwg'),
('1c10697f-2456-48ff-bbdb-ee6cbe5f4e4a', 3, '16:00:00', 'https://meet.google.com/icn-zdoj-oqn'),
('1c10697f-2456-48ff-bbdb-ee6cbe5f4e4a', 3, '17:15:00', 'https://meet.google.com/bbd-tfmr-cwg'),
-- Quinta (day_of_week = 4)
('1c10697f-2456-48ff-bbdb-ee6cbe5f4e4a', 4, '09:00:00', 'https://meet.google.com/icn-zdoj-oqn'),
('1c10697f-2456-48ff-bbdb-ee6cbe5f4e4a', 4, '10:15:00', 'https://meet.google.com/bbd-tfmr-cwg'),
('1c10697f-2456-48ff-bbdb-ee6cbe5f4e4a', 4, '11:30:00', 'https://meet.google.com/icn-zdoj-oqn'),
('1c10697f-2456-48ff-bbdb-ee6cbe5f4e4a', 4, '14:00:00', 'https://meet.google.com/bbd-tfmr-cwg'),
('1c10697f-2456-48ff-bbdb-ee6cbe5f4e4a', 4, '16:00:00', 'https://meet.google.com/icn-zdoj-oqn'),
('1c10697f-2456-48ff-bbdb-ee6cbe5f4e4a', 4, '17:15:00', 'https://meet.google.com/bbd-tfmr-cwg'),
-- Sexta (day_of_week = 5)
('1c10697f-2456-48ff-bbdb-ee6cbe5f4e4a', 5, '09:00:00', 'https://meet.google.com/icn-zdoj-oqn'),
('1c10697f-2456-48ff-bbdb-ee6cbe5f4e4a', 5, '10:15:00', 'https://meet.google.com/bbd-tfmr-cwg'),
('1c10697f-2456-48ff-bbdb-ee6cbe5f4e4a', 5, '11:15:00', 'https://meet.google.com/icn-zdoj-oqn'),
('1c10697f-2456-48ff-bbdb-ee6cbe5f4e4a', 5, '13:00:00', 'https://meet.google.com/bbd-tfmr-cwg'),
('1c10697f-2456-48ff-bbdb-ee6cbe5f4e4a', 5, '14:00:00', 'https://meet.google.com/icn-zdoj-oqn'),
('1c10697f-2456-48ff-bbdb-ee6cbe5f4e4a', 5, '15:00:00', 'https://meet.google.com/icn-zdoj-oqn');

-- Insert Cristiane's links (ID: ae78cf12-a9aa-4c51-855f-a64f5373d339)
-- Terça (day_of_week = 2)
INSERT INTO public.closer_meeting_links (closer_id, day_of_week, start_time, google_meet_link) VALUES
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 2, '09:00:00', 'https://meet.google.com/afw-rucq-ndf'),
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 2, '10:15:00', 'https://meet.google.com/itw-asvz-rus'),
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 2, '11:30:00', 'https://meet.google.com/afw-rucq-ndf'),
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 2, '14:00:00', 'https://meet.google.com/itw-asvz-rus'),
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 2, '15:00:00', 'https://meet.google.com/uan-ggec-tdo'),
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 2, '16:00:00', 'https://meet.google.com/afw-rucq-ndf'),
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 2, '17:15:00', 'https://meet.google.com/itw-asvz-rus'),
-- Quarta (day_of_week = 3)
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 3, '09:00:00', 'https://meet.google.com/afw-rucq-ndf'),
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 3, '10:15:00', 'https://meet.google.com/itw-asvz-rus'),
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 3, '11:15:00', 'https://meet.google.com/afw-rucq-ndf'),
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 3, '14:00:00', 'https://meet.google.com/itw-asvz-rus'),
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 3, '16:00:00', 'https://meet.google.com/afw-rucq-ndf'),
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 3, '17:15:00', 'https://meet.google.com/itw-asvz-rus'),
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 3, '18:15:00', 'https://meet.google.com/afw-rucq-ndf'),
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 3, '19:15:00', 'https://meet.google.com/itw-asvz-rus'),
-- Quinta (day_of_week = 4)
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 4, '09:00:00', 'https://meet.google.com/afw-rucq-ndf'),
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 4, '10:15:00', 'https://meet.google.com/itw-asvz-rus'),
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 4, '11:15:00', 'https://meet.google.com/afw-rucq-ndf'),
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 4, '14:00:00', 'https://meet.google.com/itw-asvz-rus'),
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 4, '16:00:00', 'https://meet.google.com/afw-rucq-ndf'),
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 4, '17:15:00', 'https://meet.google.com/itw-asvz-rus'),
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 4, '18:15:00', 'https://meet.google.com/itw-asvz-rus'),
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 4, '19:15:00', 'https://meet.google.com/afw-rucq-ndf'),
-- Sexta (day_of_week = 5)
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 5, '09:00:00', 'https://meet.google.com/itw-asvz-rus'),
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 5, '10:15:00', 'https://meet.google.com/afw-rucq-ndf'),
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 5, '11:30:00', 'https://meet.google.com/itw-asvz-rus'),
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 5, '12:45:00', 'https://meet.google.com/afw-rucq-ndf'),
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 5, '14:00:00', 'https://meet.google.com/itw-asvz-rus'),
-- Sábado (day_of_week = 6)
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 6, '09:00:00', 'https://meet.google.com/itw-asvz-rus'),
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 6, '10:15:00', 'https://meet.google.com/afw-rucq-ndf'),
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 6, '11:30:00', 'https://meet.google.com/itw-asvz-rus'),
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 6, '12:45:00', 'https://meet.google.com/afw-rucq-ndf'),
('ae78cf12-a9aa-4c51-855f-a64f5373d339', 6, '14:00:00', 'https://meet.google.com/itw-asvz-rus');