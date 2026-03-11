
CREATE TABLE public.manual_sale_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closer_id uuid NOT NULL REFERENCES closers(id) ON DELETE CASCADE,
  contact_name text NOT NULL,
  contact_email text,
  contact_phone text,
  contract_paid_at timestamptz NOT NULL,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  business_unit text DEFAULT 'incorporador'
);

ALTER TABLE public.manual_sale_attributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coordenador+ can manage manual attributions"
ON public.manual_sale_attributions FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') 
  OR public.has_role(auth.uid(), 'manager') 
  OR public.has_role(auth.uid(), 'coordenador')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') 
  OR public.has_role(auth.uid(), 'manager') 
  OR public.has_role(auth.uid(), 'coordenador')
);

-- Allow all authenticated users to read (for metrics display)
CREATE POLICY "Authenticated users can read manual attributions"
ON public.manual_sale_attributions FOR SELECT TO authenticated
USING (true);
