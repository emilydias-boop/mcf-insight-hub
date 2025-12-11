-- Create calls table for Twilio call tracking
CREATE TABLE public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES crm_deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  origin_id UUID REFERENCES crm_origins(id) ON DELETE SET NULL,
  twilio_call_sid TEXT,
  to_number TEXT NOT NULL,
  from_number TEXT,
  direction TEXT DEFAULT 'outbound',
  status TEXT DEFAULT 'initiated',
  duration_seconds INTEGER,
  outcome TEXT,
  notes TEXT,
  recording_url TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- Users can create calls
CREATE POLICY "Authenticated users can create calls"
ON public.calls
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Users can view their own calls
CREATE POLICY "Users can view their own calls"
ON public.calls
FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Users can update their own calls
CREATE POLICY "Users can update their own calls"
ON public.calls
FOR UPDATE
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for performance
CREATE INDEX idx_calls_user_id ON public.calls(user_id);
CREATE INDEX idx_calls_deal_id ON public.calls(deal_id);
CREATE INDEX idx_calls_contact_id ON public.calls(contact_id);
CREATE INDEX idx_calls_created_at ON public.calls(created_at DESC);
CREATE INDEX idx_calls_twilio_sid ON public.calls(twilio_call_sid);

-- Trigger for updated_at
CREATE TRIGGER update_calls_updated_at
BEFORE UPDATE ON public.calls
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();