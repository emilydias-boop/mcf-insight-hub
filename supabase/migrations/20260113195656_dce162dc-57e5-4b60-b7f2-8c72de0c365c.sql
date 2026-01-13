-- Create encaixe_queue table for squeeze-in waiting list
CREATE TABLE public.encaixe_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  closer_id UUID NOT NULL REFERENCES public.closers(id) ON DELETE CASCADE,
  preferred_date DATE NOT NULL,
  preferred_time_start TIME,
  preferred_time_end TIME,
  lead_type TEXT NOT NULL DEFAULT 'A',
  priority INTEGER DEFAULT 1 CHECK (priority BETWEEN 1 AND 3),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'scheduled', 'expired', 'canceled')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  notified_at TIMESTAMPTZ,
  scheduled_meeting_id UUID REFERENCES public.meeting_slots(id) ON DELETE SET NULL
);

-- Add comment
COMMENT ON TABLE public.encaixe_queue IS 'Queue for leads waiting for squeeze-in slots when closer agenda is full';

-- Indexes for fast lookup
CREATE INDEX idx_encaixe_queue_closer_date ON public.encaixe_queue(closer_id, preferred_date, status);
CREATE INDEX idx_encaixe_queue_status ON public.encaixe_queue(status);
CREATE INDEX idx_encaixe_queue_deal ON public.encaixe_queue(deal_id);

-- Enable RLS
ALTER TABLE public.encaixe_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view all encaixe_queue"
  ON public.encaixe_queue FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert encaixe_queue"
  ON public.encaixe_queue FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update encaixe_queue"
  ON public.encaixe_queue FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can delete encaixe_queue"
  ON public.encaixe_queue FOR DELETE TO authenticated USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_encaixe_queue_updated_at
  BEFORE UPDATE ON public.encaixe_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();