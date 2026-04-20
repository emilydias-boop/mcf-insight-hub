ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_manage_agenda boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_handle_no_show boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_link_contract boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_cancel_meeting boolean NOT NULL DEFAULT false;