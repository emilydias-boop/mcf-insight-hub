-- Create table for external/manual sales that weren't in the original cart
CREATE TABLE public.r2_vendas_extras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  attendee_name TEXT NOT NULL,
  attendee_phone TEXT,
  attendee_email TEXT,
  closer_id UUID REFERENCES closers(id),
  sale_date TIMESTAMPTZ DEFAULT NOW(),
  hubla_transaction_id UUID REFERENCES hubla_transactions(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.r2_vendas_extras ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view all r2_vendas_extras" 
ON public.r2_vendas_extras 
FOR SELECT 
USING (true);

CREATE POLICY "Users can insert r2_vendas_extras" 
ON public.r2_vendas_extras 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update r2_vendas_extras" 
ON public.r2_vendas_extras 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can delete r2_vendas_extras" 
ON public.r2_vendas_extras 
FOR DELETE 
USING (true);

-- Create index for week lookups
CREATE INDEX idx_r2_vendas_extras_week ON public.r2_vendas_extras(week_start);