
-- Table for storing parsed boleto data
CREATE TABLE public.consorcio_boletos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID REFERENCES public.consortium_cards(id) ON DELETE SET NULL,
  installment_id UUID REFERENCES public.consortium_installments(id) ON DELETE SET NULL,
  nome_extraido TEXT,
  grupo_extraido TEXT,
  cota_extraida TEXT,
  valor_extraido NUMERIC,
  vencimento_extraido DATE,
  linha_digitavel TEXT,
  codigo_barras TEXT,
  storage_path TEXT NOT NULL,
  match_confidence TEXT NOT NULL DEFAULT 'pending_review' CHECK (match_confidence IN ('exact', 'partial', 'manual', 'pending_review')),
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('matched', 'pending_review', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.consorcio_boletos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view boletos"
  ON public.consorcio_boletos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert boletos"
  ON public.consorcio_boletos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update boletos"
  ON public.consorcio_boletos FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete boletos"
  ON public.consorcio_boletos FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_consorcio_boletos_updated_at
  BEFORE UPDATE ON public.consorcio_boletos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for boleto PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('consorcio-boletos', 'consorcio-boletos', false);

CREATE POLICY "Authenticated users can upload boletos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'consorcio-boletos');

CREATE POLICY "Authenticated users can view boletos storage"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'consorcio-boletos');

CREATE POLICY "Authenticated users can delete boletos storage"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'consorcio-boletos');
