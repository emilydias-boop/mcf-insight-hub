
-- History tables for contemplação module

-- Sorteio history
CREATE TABLE public.consorcio_sorteio_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.consortium_cards(id) ON DELETE CASCADE,
  numero_sorteado TEXT NOT NULL,
  contemplado BOOLEAN NOT NULL DEFAULT false,
  distancia INTEGER NOT NULL DEFAULT 0,
  data_assembleia DATE NOT NULL,
  observacao TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lance history
CREATE TABLE public.consorcio_lance_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.consortium_cards(id) ON DELETE CASCADE,
  percentual_lance NUMERIC NOT NULL,
  valor_lance NUMERIC NOT NULL,
  chance_classificacao TEXT NOT NULL DEFAULT 'baixa',
  posicao_estimada INTEGER,
  observacao TEXT,
  salvo BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_sorteio_history_card ON public.consorcio_sorteio_history(card_id);
CREATE INDEX idx_lance_history_card ON public.consorcio_lance_history(card_id);

-- Enable RLS
ALTER TABLE public.consorcio_sorteio_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consorcio_lance_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sorteio_history
CREATE POLICY "Authenticated users can insert sorteio history"
  ON public.consorcio_sorteio_history FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read sorteio history"
  ON public.consorcio_sorteio_history FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/manager can delete sorteio history"
  ON public.consorcio_sorteio_history FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'coordenador')
  );

-- RLS Policies for lance_history
CREATE POLICY "Authenticated users can insert lance history"
  ON public.consorcio_lance_history FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read lance history"
  ON public.consorcio_lance_history FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/manager can delete lance history"
  ON public.consorcio_lance_history FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'coordenador')
  );
