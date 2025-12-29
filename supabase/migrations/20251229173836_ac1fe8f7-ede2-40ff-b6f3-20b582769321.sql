-- Add source column to meeting_slots to track where appointments came from
ALTER TABLE meeting_slots 
ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

COMMENT ON COLUMN meeting_slots.source IS 'Origem do agendamento: manual, clint_webhook, calendly_webhook';

-- Update Calendly links for closers
UPDATE closers SET calendly_default_link = 'https://calendly.com/julio-mcf/reuniao-r01', updated_at = NOW() WHERE id = '697b1c04-6dd0-4955-8f33-2e0bcfaad007';
UPDATE closers SET calendly_default_link = 'https://calendly.com/thayna-mcf/reuniao-r01', updated_at = NOW() WHERE id = '1c10697f-2456-48ff-bbdb-ee6cbe5f4e4a';
UPDATE closers SET calendly_default_link = 'https://calendly.com/jessica-mcf/reuniao-r01', updated_at = NOW() WHERE id = '1ed213d0-c4ff-466a-abac-2e50400963e4';
UPDATE closers SET calendly_default_link = 'https://calendly.com/deisi-mcf/reuniao-r01', updated_at = NOW() WHERE id = '63d91825-82bf-45e8-ab58-3465c6d04c95';