
CREATE TABLE public.consorcio_vendedor_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.consorcio_vendedor_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read vendedor options"
  ON public.consorcio_vendedor_options FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert vendedor options"
  ON public.consorcio_vendedor_options FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update vendedor options"
  ON public.consorcio_vendedor_options FOR UPDATE TO authenticated USING (true);

INSERT INTO public.consorcio_vendedor_options (name, display_order) VALUES
  ('Cleiton Anacleto Lima', 1),
  ('Fabio Damiao Sant Ana Campos', 2),
  ('Ithaline Clara dos Santos', 3),
  ('Joao Pedro Martins Vieira', 4),
  ('Luis Felipe de Souza Oliveira Ramos', 5),
  ('Thobson', 6),
  ('Victoria Paz', 7),
  ('Ygor Fereira', 8),
  ('Grimaldo Neto', 9),
  ('Diego Carielo', 10),
  ('Vinicius Motta Campos', 11);
