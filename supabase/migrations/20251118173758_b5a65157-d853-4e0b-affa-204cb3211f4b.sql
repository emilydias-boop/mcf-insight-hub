-- Fix view to be SECURITY INVOKER explicitly
ALTER VIEW public.user_performance_summary SET (security_invoker = true);

-- Fix update_updated_at_column function to have search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;