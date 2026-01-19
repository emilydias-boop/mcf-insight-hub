-- Create table for configurable attempt limits per stage
CREATE TABLE public.stage_attempt_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID REFERENCES public.crm_stages(id) ON DELETE CASCADE,
  stage_name TEXT,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(stage_id)
);

-- Enable RLS
ALTER TABLE public.stage_attempt_limits ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view limits
CREATE POLICY "Authenticated users can view stage attempt limits"
ON public.stage_attempt_limits
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to manage limits (can restrict to admin later)
CREATE POLICY "Authenticated users can manage stage attempt limits"
ON public.stage_attempt_limits
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_stage_attempt_limits_updated_at
BEFORE UPDATE ON public.stage_attempt_limits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();