-- Add color column to closers table
ALTER TABLE public.closers ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3B82F6';

-- Create table for blocked dates
CREATE TABLE IF NOT EXISTS public.closer_blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closer_id UUID NOT NULL REFERENCES public.closers(id) ON DELETE CASCADE,
  blocked_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(closer_id, blocked_date)
);

-- Enable RLS
ALTER TABLE public.closer_blocked_dates ENABLE ROW LEVEL SECURITY;

-- RLS policies for blocked dates
CREATE POLICY "Authenticated users can view blocked dates"
  ON public.closer_blocked_dates
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and coordenadores can manage blocked dates"
  ON public.closer_blocked_dates
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role));

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_closer_blocked_dates_closer ON public.closer_blocked_dates(closer_id);
CREATE INDEX IF NOT EXISTS idx_closer_blocked_dates_date ON public.closer_blocked_dates(blocked_date);