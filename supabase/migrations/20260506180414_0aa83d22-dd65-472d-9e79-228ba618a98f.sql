
-- 1. Tabela de objetivos configuráveis
CREATE TABLE IF NOT EXISTS public.consorcio_objetivo_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  label text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.consorcio_objetivo_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read consorcio_objetivo_options"
  ON public.consorcio_objetivo_options FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage consorcio_objetivo_options insert"
  ON public.consorcio_objetivo_options FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage consorcio_objetivo_options update"
  ON public.consorcio_objetivo_options FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage consorcio_objetivo_options delete"
  ON public.consorcio_objetivo_options FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_consorcio_objetivo_options_updated_at
  BEFORE UPDATE ON public.consorcio_objetivo_options
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Seed inicial
INSERT INTO public.consorcio_objetivo_options (name, label, display_order)
VALUES ('imovel','Imóvel',0), ('auto','Auto',1)
ON CONFLICT (name) DO NOTHING;

-- 3. Vincular produtos a objetivo + prazo máximo
ALTER TABLE public.consorcio_produtos
  ADD COLUMN IF NOT EXISTS objetivo_option_id uuid REFERENCES public.consorcio_objetivo_options(id),
  ADD COLUMN IF NOT EXISTS prazo_maximo_venda integer;

-- 4. Backfill: produtos existentes como Imóvel
UPDATE public.consorcio_produtos
SET objetivo_option_id = (SELECT id FROM public.consorcio_objetivo_options WHERE name='imovel')
WHERE objetivo_option_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_consorcio_produtos_objetivo ON public.consorcio_produtos(objetivo_option_id);
