-- Criar tabela de produtos associados aos funcionários
CREATE TABLE public.employee_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(employee_id, product_code)
);

-- Habilitar RLS
ALTER TABLE public.employee_products ENABLE ROW LEVEL SECURITY;

-- Política: usuários autenticados podem ver seus próprios produtos
CREATE POLICY "Users can view own products" ON public.employee_products
  FOR SELECT TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM public.employees WHERE user_id = auth.uid()
    )
  );

-- Política: admins podem fazer tudo
CREATE POLICY "Admins can manage all products" ON public.employee_products
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
  );

-- Política: managers podem gerenciar
CREATE POLICY "Managers can manage products" ON public.employee_products
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager')
  );

-- Index para performance
CREATE INDEX idx_employee_products_employee ON public.employee_products(employee_id);
CREATE INDEX idx_employee_products_code ON public.employee_products(product_code);