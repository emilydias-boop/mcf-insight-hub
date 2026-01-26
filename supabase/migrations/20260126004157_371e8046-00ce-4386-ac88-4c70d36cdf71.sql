-- Criar tabela task_spaces para hierarquia de Setores > Pastas > Listas
CREATE TABLE public.task_spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('setor', 'pasta', 'lista')),
  parent_id UUID REFERENCES public.task_spaces(id) ON DELETE CASCADE,
  icon TEXT DEFAULT NULL,
  color TEXT DEFAULT NULL,
  order_index INTEGER DEFAULT 0,
  is_private BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_task_spaces_parent ON public.task_spaces(parent_id);
CREATE INDEX idx_task_spaces_type ON public.task_spaces(type);
CREATE INDEX idx_task_spaces_order ON public.task_spaces(order_index);

-- Enable RLS
ALTER TABLE public.task_spaces ENABLE ROW LEVEL SECURITY;

-- Policy: Todos autenticados podem visualizar
CREATE POLICY "Authenticated users can view task_spaces"
  ON public.task_spaces FOR SELECT TO authenticated
  USING (true);

-- Policy: Admins, managers e coordenadores podem gerenciar
CREATE POLICY "Admins and managers can manage task_spaces"
  ON public.task_spaces FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'coordenador')
    )
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_task_spaces_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_task_spaces_updated_at
  BEFORE UPDATE ON public.task_spaces
  FOR EACH ROW
  EXECUTE FUNCTION public.update_task_spaces_updated_at();