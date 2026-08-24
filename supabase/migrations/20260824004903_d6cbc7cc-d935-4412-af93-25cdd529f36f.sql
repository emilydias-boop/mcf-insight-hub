CREATE TABLE public.consorcio_funil_reversoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entidade text NOT NULL,
  entidade_id uuid NOT NULL,
  consortium_card_id uuid,
  de_etapa integer NOT NULL,
  para_etapa integer NOT NULL,
  motivo text NOT NULL,
  revertido_por uuid,
  revertido_por_nome text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.consorcio_funil_reversoes TO authenticated;
GRANT ALL ON public.consorcio_funil_reversoes TO service_role;

ALTER TABLE public.consorcio_funil_reversoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem reversoes"
  ON public.consorcio_funil_reversoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Autenticados registram reversoes"
  ON public.consorcio_funil_reversoes FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_funil_reversoes_entidade ON public.consorcio_funil_reversoes (entidade, entidade_id, created_at DESC);
CREATE INDEX idx_funil_reversoes_card ON public.consorcio_funil_reversoes (consortium_card_id);

ALTER TABLE public.consortium_cards
  ADD COLUMN revertida_em timestamp with time zone,
  ADD COLUMN revertida_por uuid,
  ADD COLUMN revertida_motivo text;