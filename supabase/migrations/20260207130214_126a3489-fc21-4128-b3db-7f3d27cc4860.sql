-- Corrigir função is_own_sdr para fallback por email
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
        OR (
          user_id IS NULL 
          AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
      )
  )
$$;

-- Atualizar policy da tabela sdr
DROP POLICY IF EXISTS "SDRs podem ver seus próprios dados" ON public.sdr;

CREATE POLICY "SDRs podem ver seus próprios dados"
ON public.sdr FOR SELECT
USING (
  user_id = auth.uid()
  OR (
    user_id IS NULL 
    AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- Atualizar policy da tabela sdr_month_payout para usar a função atualizada
DROP POLICY IF EXISTS "SDRs podem ver seus próprios payouts" ON public.sdr_month_payout;

CREATE POLICY "SDRs podem ver seus próprios payouts"
ON public.sdr_month_payout FOR SELECT
USING (is_own_sdr(sdr_id));