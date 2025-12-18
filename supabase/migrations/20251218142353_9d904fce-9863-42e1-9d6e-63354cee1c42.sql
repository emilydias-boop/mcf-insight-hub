-- Create table for SDR review requests
CREATE TABLE public.sdr_review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  periodo TEXT NOT NULL,
  tipo_problema TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'aberto',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sdr_review_requests ENABLE ROW LEVEL SECURITY;

-- SDR can view their own requests
CREATE POLICY "Users can view their own review requests"
ON public.sdr_review_requests
FOR SELECT
USING (user_id = auth.uid());

-- SDR can create their own requests
CREATE POLICY "Users can create their own review requests"
ON public.sdr_review_requests
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Admin and coordenador can view all requests
CREATE POLICY "Admin and coordenador can view all review requests"
ON public.sdr_review_requests
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'coordenador')
);

-- Admin can update status
CREATE POLICY "Admin can update review requests"
ON public.sdr_review_requests
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_sdr_review_requests_updated_at
BEFORE UPDATE ON public.sdr_review_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();