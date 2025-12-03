-- Criar enum user_status
CREATE TYPE public.user_status AS ENUM ('ativo', 'ferias', 'inativo', 'pendente_aprovacao');

-- Adicionar coluna status na tabela user_employment_data
ALTER TABLE public.user_employment_data 
ADD COLUMN IF NOT EXISTS status public.user_status NOT NULL DEFAULT 'ativo';

-- Expandir resource_type com novos valores
ALTER TYPE public.resource_type ADD VALUE IF NOT EXISTS 'crm';
ALTER TYPE public.resource_type ADD VALUE IF NOT EXISTS 'fechamento_sdr';
ALTER TYPE public.resource_type ADD VALUE IF NOT EXISTS 'tv_sdr';
ALTER TYPE public.resource_type ADD VALUE IF NOT EXISTS 'usuarios';

-- Atualizar view user_performance_summary para incluir status
DROP VIEW IF EXISTS public.user_performance_summary;

CREATE VIEW public.user_performance_summary AS
SELECT 
  p.id as user_id,
  p.email,
  p.full_name,
  ur.role,
  ued.position,
  ued.hire_date,
  ued.is_active,
  ued.status,
  ued.fixed_salary,
  ued.ote,
  COALESCE((
    SELECT COUNT(*) 
    FROM public.user_flags uf 
    WHERE uf.user_id = p.id 
      AND uf.flag_type = 'red' 
      AND uf.is_resolved = false
  ), 0)::integer as red_flags_count,
  COALESCE((
    SELECT COUNT(*) 
    FROM public.user_flags uf 
    WHERE uf.user_id = p.id 
      AND uf.flag_type = 'yellow' 
      AND uf.is_resolved = false
  ), 0)::integer as yellow_flags_count,
  COALESCE((
    SELECT COUNT(*) 
    FROM public.user_targets ut 
    WHERE ut.user_id = p.id 
      AND ut.is_achieved = true
  ), 0)::integer as targets_achieved,
  COALESCE((
    SELECT COUNT(*) 
    FROM public.user_targets ut 
    WHERE ut.user_id = p.id
  ), 0)::integer as total_targets,
  NULL::numeric as avg_performance_3m
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
LEFT JOIN public.user_employment_data ued ON ued.user_id = p.id;