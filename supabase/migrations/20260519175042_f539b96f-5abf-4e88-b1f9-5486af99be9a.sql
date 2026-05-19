UPDATE public.meeting_slot_attendees
SET booked_by = '7aa935e2-73e1-4624-b189-aa9784e29485', -- Nicola Ricci
    booked_at = COALESCE(booked_at, created_at)
WHERE id = '55764437-1c40-4a8f-bba6-894429bd8109';