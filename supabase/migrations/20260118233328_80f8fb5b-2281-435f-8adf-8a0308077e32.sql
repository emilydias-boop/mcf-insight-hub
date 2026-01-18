-- Tabela de configuração de produtos
CREATE TABLE public.product_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT UNIQUE NOT NULL,
  product_code TEXT,
  display_name TEXT,
  product_category TEXT NOT NULL DEFAULT 'outros',
  target_bu TEXT,
  reference_price NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  count_in_dashboard BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para updated_at
CREATE TRIGGER update_product_configurations_updated_at
  BEFORE UPDATE ON public.product_configurations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.product_configurations ENABLE ROW LEVEL SECURITY;

-- Políticas - todos autenticados podem ler e gerenciar (admin controlado pelo frontend)
CREATE POLICY "Authenticated users can read product configurations"
ON public.product_configurations FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert product configurations"
ON public.product_configurations FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update product configurations"
ON public.product_configurations FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete product configurations"
ON public.product_configurations FOR DELETE TO authenticated
USING (true);

-- Popular com produtos existentes das transações
INSERT INTO public.product_configurations (product_name, product_category, reference_price)
SELECT DISTINCT 
  product_name,
  COALESCE(product_category, 'outros'),
  COALESCE(MAX(product_price), 0)
FROM hubla_transactions
WHERE product_name IS NOT NULL
GROUP BY product_name, product_category
ON CONFLICT (product_name) DO NOTHING;