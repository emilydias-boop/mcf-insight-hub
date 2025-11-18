-- First, add email column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Update handle_new_user function to include email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email);
  RETURN new;
END;
$$;

-- Drop and recreate user_performance_summary view without SECURITY DEFINER
DROP VIEW IF EXISTS public.user_performance_summary CASCADE;

CREATE VIEW public.user_performance_summary AS
SELECT 
  p.id as user_id,
  p.full_name,
  p.email,
  ued.position,
  ued.fixed_salary,
  ued.ote,
  ued.hire_date,
  ued.is_active,
  ur.role,
  COUNT(DISTINCT ut.id) FILTER (WHERE ut.is_achieved = true) as targets_achieved,
  COUNT(DISTINCT ut.id) as total_targets,
  AVG(CASE WHEN ut.is_achieved THEN 100.0 ELSE (ut.current_value / NULLIF(ut.target_value, 0) * 100.0) END) as avg_performance_3m,
  COUNT(DISTINCT uf.id) FILTER (WHERE uf.flag_type = 'red' AND uf.is_resolved = false) as red_flags_count,
  COUNT(DISTINCT uf.id) FILTER (WHERE uf.flag_type = 'yellow' AND uf.is_resolved = false) as yellow_flags_count
FROM public.profiles p
LEFT JOIN public.user_employment_data ued ON ued.user_id = p.id
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
LEFT JOIN public.user_targets ut ON ut.user_id = p.id 
  AND ut.start_date >= CURRENT_DATE - INTERVAL '3 months'
LEFT JOIN public.user_flags uf ON uf.user_id = p.id
GROUP BY p.id, p.full_name, p.email, ued.position, ued.fixed_salary, ued.ote, ued.hire_date, ued.is_active, ur.role;

-- Fix auto_assign_first_admin function search path
CREATE OR REPLACE FUNCTION public.auto_assign_first_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count int;
BEGIN
  SELECT count(*) INTO user_count FROM public.user_roles;
  
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'viewer');
  END IF;
  
  RETURN new;
END;
$$;