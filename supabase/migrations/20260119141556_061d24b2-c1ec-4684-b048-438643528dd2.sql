-- Tabela para stages locais, independentes do Clint
CREATE TABLE public.local_pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  color VARCHAR(50) DEFAULT '#3B82F6',
  stage_order INTEGER NOT NULL DEFAULT 0,
  stage_type VARCHAR(50) DEFAULT 'open', -- open, won, lost
  -- Pode ser vinculado a um grupo OU origem
  group_id UUID REFERENCES public.crm_groups(id) ON DELETE CASCADE,
  origin_id UUID REFERENCES public.crm_origins(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Garantir que tenha grupo OU origem
  CONSTRAINT local_stages_parent_check CHECK (
    (group_id IS NOT NULL AND origin_id IS NULL) OR
    (group_id IS NULL AND origin_id IS NOT NULL)
  )
);

-- Índices para performance
CREATE INDEX idx_local_stages_group ON public.local_pipeline_stages(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX idx_local_stages_origin ON public.local_pipeline_stages(origin_id) WHERE origin_id IS NOT NULL;
CREATE INDEX idx_local_stages_order ON public.local_pipeline_stages(stage_order);

-- Enable RLS
ALTER TABLE public.local_pipeline_stages ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - todos autenticados podem ler
CREATE POLICY "Authenticated users can read local stages"
ON public.local_pipeline_stages FOR SELECT
TO authenticated
USING (true);

-- Apenas admins podem modificar (ou ajustar conforme necessidade)
CREATE POLICY "Authenticated users can manage local stages"
ON public.local_pipeline_stages FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_local_pipeline_stages_updated_at
BEFORE UPDATE ON public.local_pipeline_stages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Copiar stages únicas do grupo Perpétuo X1 para local_pipeline_stages
INSERT INTO public.local_pipeline_stages (name, color, stage_order, group_id)
SELECT DISTINCT ON (s.stage_name)
  s.stage_name,
  COALESCE(s.color, '#3B82F6'),
  s.stage_order,
  'a6f3cbfc-0567-427f-a405-5a869aaa6010'::uuid
FROM public.crm_stages s
JOIN public.crm_origins o ON s.origin_id = o.id
WHERE o.group_id = 'a6f3cbfc-0567-427f-a405-5a869aaa6010'
  AND s.is_active = true
ORDER BY s.stage_name, s.stage_order;