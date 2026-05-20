ALTER TABLE public.meeting_reminder_settings
  ADD COLUMN IF NOT EXISTS applies_to_bus text[] DEFAULT NULL;

COMMENT ON COLUMN public.meeting_reminder_settings.applies_to_bus IS
  'Lista de BUs (crm_deals.bu_origem) para as quais lembretes serão enviados. NULL ou vazio = todas as BUs (comportamento global).';