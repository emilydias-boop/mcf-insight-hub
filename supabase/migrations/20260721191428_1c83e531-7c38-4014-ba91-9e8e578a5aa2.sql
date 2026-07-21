-- Table for refunds ("baixa sem numerário")
CREATE TABLE public.ar_reembolsos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo_id uuid NOT NULL REFERENCES public.ar_titulos(id) ON DELETE CASCADE,
  valor numeric(14,2) NOT NULL,
  motivo text,
  data_pedido date NOT NULL DEFAULT CURRENT_DATE,
  data_prevista_pagamento date,
  data_pagamento date,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','cancelado')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ar_reembolsos TO authenticated;
GRANT ALL ON public.ar_reembolsos TO service_role;

ALTER TABLE public.ar_reembolsos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ar_reembolsos_authenticated_all"
  ON public.ar_reembolsos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_ar_reembolsos_titulo ON public.ar_reembolsos(titulo_id);
CREATE INDEX idx_ar_reembolsos_status ON public.ar_reembolsos(status);
CREATE INDEX idx_ar_reembolsos_data_prevista ON public.ar_reembolsos(data_prevista_pagamento);

CREATE OR REPLACE FUNCTION public.tg_ar_reembolsos_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ar_reembolsos_updated_at
  BEFORE UPDATE ON public.ar_reembolsos
  FOR EACH ROW EXECUTE FUNCTION public.tg_ar_reembolsos_updated_at();

-- Allow "reembolsado" status on titles
ALTER TABLE public.ar_titulos DROP CONSTRAINT IF EXISTS ar_titulos_status_check;
ALTER TABLE public.ar_titulos ADD CONSTRAINT ar_titulos_status_check
  CHECK (status IN ('aberto','quitado','cancelado','reembolsado'));