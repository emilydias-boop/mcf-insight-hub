-- Criar tabela a010_sales para vendas do curso A010
CREATE TABLE IF NOT EXISTS public.a010_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_date DATE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  net_value NUMERIC NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Criar índice para melhor performance em consultas por data
CREATE INDEX idx_a010_sales_sale_date ON public.a010_sales(sale_date DESC);
CREATE INDEX idx_a010_sales_customer_email ON public.a010_sales(customer_email);

-- Habilitar RLS
ALTER TABLE public.a010_sales ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Authenticated users can view a010 sales"
  ON public.a010_sales
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can insert a010 sales"
  ON public.a010_sales
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Managers can update a010 sales"
  ON public.a010_sales
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can delete a010 sales"
  ON public.a010_sales
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_a010_sales_updated_at
  BEFORE UPDATE ON public.a010_sales
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários
COMMENT ON TABLE public.a010_sales IS 'Tabela para armazenar vendas do curso A010';
COMMENT ON COLUMN public.a010_sales.sale_date IS 'Data da venda (formato: Data da planilha)';
COMMENT ON COLUMN public.a010_sales.customer_name IS 'Nome completo do cliente (formato: Nome Completo)';
COMMENT ON COLUMN public.a010_sales.customer_email IS 'Email do cliente (formato: Email)';
COMMENT ON COLUMN public.a010_sales.customer_phone IS 'Telefone do cliente (formato: Telefone)';
COMMENT ON COLUMN public.a010_sales.net_value IS 'Valor líquido da venda (formato: Valor Líquido da Venda)';
COMMENT ON COLUMN public.a010_sales.status IS 'Status da venda para controle (padrão: completed)';