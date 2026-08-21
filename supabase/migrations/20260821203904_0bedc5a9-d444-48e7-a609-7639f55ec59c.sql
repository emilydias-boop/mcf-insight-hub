-- helper: closer ids do usuário logado (por e-mail do JWT)
CREATE OR REPLACE FUNCTION public.is_own_closer(_closer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.closers c
    WHERE c.id = _closer_id
      AND lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

CREATE OR REPLACE FUNCTION public.is_fechamento_leader()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'coordenador')
      OR public.has_role(auth.uid(), 'financeiro')
      OR public.has_role(auth.uid(), 'rh');
$$;

-- 1) closer_commissions
DROP POLICY IF EXISTS "Authenticated users can view commissions" ON public.closer_commissions;
CREATE POLICY "Leadership can view commissions"
ON public.closer_commissions FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'financeiro')
  OR public.has_role(auth.uid(), 'rh')
);

-- 2) sdr_levels: remover acesso anônimo
DROP POLICY IF EXISTS "Todos podem visualizar níveis SDR" ON public.sdr_levels;
CREATE POLICY "Usuarios logados podem visualizar niveis SDR"
ON public.sdr_levels FOR SELECT TO authenticated
USING (true);
REVOKE SELECT ON public.sdr_levels FROM anon;

-- 3) consorcio_closer_payout
DROP POLICY IF EXISTS "Allow authenticated users to read consorcio_closer_payout" ON public.consorcio_closer_payout;
DROP POLICY IF EXISTS "Allow authenticated users to insert consorcio_closer_payout" ON public.consorcio_closer_payout;
DROP POLICY IF EXISTS "Allow authenticated users to update consorcio_closer_payout" ON public.consorcio_closer_payout;
DROP POLICY IF EXISTS "Allow authenticated users to delete consorcio_closer_payout" ON public.consorcio_closer_payout;

CREATE POLICY "Leadership or own payout can read"
ON public.consorcio_closer_payout FOR SELECT TO authenticated
USING (public.is_fechamento_leader() OR public.is_own_closer(closer_id));

CREATE POLICY "Leadership or own payout can insert"
ON public.consorcio_closer_payout FOR INSERT TO authenticated
WITH CHECK (public.is_fechamento_leader() OR public.is_own_closer(closer_id));

CREATE POLICY "Leadership or own payout can update"
ON public.consorcio_closer_payout FOR UPDATE TO authenticated
USING (public.is_fechamento_leader() OR public.is_own_closer(closer_id))
WITH CHECK (public.is_fechamento_leader() OR public.is_own_closer(closer_id));

CREATE POLICY "Leadership can delete payout"
ON public.consorcio_closer_payout FOR DELETE TO authenticated
USING (public.is_fechamento_leader());

-- 4) consorcio_venda_holding
DROP POLICY IF EXISTS "Allow authenticated users to read consorcio_venda_holding" ON public.consorcio_venda_holding;
DROP POLICY IF EXISTS "Allow authenticated users to insert consorcio_venda_holding" ON public.consorcio_venda_holding;
DROP POLICY IF EXISTS "Allow authenticated users to update consorcio_venda_holding" ON public.consorcio_venda_holding;
DROP POLICY IF EXISTS "Allow authenticated users to delete consorcio_venda_holding" ON public.consorcio_venda_holding;

CREATE POLICY "Leadership or own holding can read"
ON public.consorcio_venda_holding FOR SELECT TO authenticated
USING (public.is_fechamento_leader() OR public.is_own_closer(closer_id));

CREATE POLICY "Leadership or own holding can insert"
ON public.consorcio_venda_holding FOR INSERT TO authenticated
WITH CHECK (public.is_fechamento_leader() OR public.is_own_closer(closer_id));

CREATE POLICY "Leadership or own holding can update"
ON public.consorcio_venda_holding FOR UPDATE TO authenticated
USING (public.is_fechamento_leader() OR public.is_own_closer(closer_id))
WITH CHECK (public.is_fechamento_leader() OR public.is_own_closer(closer_id));

CREATE POLICY "Leadership or own holding can delete"
ON public.consorcio_venda_holding FOR DELETE TO authenticated
USING (public.is_fechamento_leader() OR public.is_own_closer(closer_id));