-- Atualizar função is_own_sdr para usar auth.email() em vez de subquery
CREATE OR REPLACE FUNCTION public.is_own_sdr(_sdr_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sdr
    WHERE id = _sdr_id 
      AND (
        user_id = auth.uid()
        OR (user_id IS NULL AND email = auth.email())
      )
  )
$$;

-- Atualizar policy da tabela sdr para usar auth.email()
DROP POLICY IF EXISTS "SDRs podem ver seus próprios dados" ON public.sdr;

CREATE POLICY "SDRs podem ver seus próprios dados"
ON public.sdr FOR SELECT
USING (
  user_id = auth.uid()
  OR (user_id IS NULL AND email = auth.email())
);