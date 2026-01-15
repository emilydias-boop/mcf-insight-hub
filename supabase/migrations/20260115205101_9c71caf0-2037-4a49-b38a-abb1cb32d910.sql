-- Create table for R2 daily slots (date-specific availability)
CREATE TABLE public.r2_daily_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closer_id UUID NOT NULL REFERENCES public.closers(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  google_meet_link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(closer_id, slot_date, start_time)
);

-- Enable RLS
ALTER TABLE public.r2_daily_slots ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
CREATE POLICY "Authenticated users can view r2_daily_slots"
  ON public.r2_daily_slots FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert r2_daily_slots"
  ON public.r2_daily_slots FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update r2_daily_slots"
  ON public.r2_daily_slots FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete r2_daily_slots"
  ON public.r2_daily_slots FOR DELETE TO authenticated USING (true);

-- Create index for faster queries
CREATE INDEX idx_r2_daily_slots_closer_date ON public.r2_daily_slots(closer_id, slot_date);
CREATE INDEX idx_r2_daily_slots_date ON public.r2_daily_slots(slot_date);