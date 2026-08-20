-- 1. Views: enforce querying user's RLS instead of view owner's privileges
ALTER VIEW public.deal_task_stats_monthly SET (security_invoker = on);
ALTER VIEW public.user_performance_summary SET (security_invoker = on);
ALTER VIEW public.v_a010_reconciliation SET (security_invoker = on);
ALTER VIEW public.v_automation_confirmacao_r1_health SET (security_invoker = on);

-- 2. Helper: who legitimately works with consortium client PII
CREATE OR REPLACE FUNCTION public.can_access_consorcio_pii(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = ANY (ARRAY[
        'admin','manager','coordenador','closer','closer_sombra',
        'sdr','financeiro','gr','assistente_administrativo'
      ]::app_role[])
  )
  OR EXISTS (
    SELECT 1 FROM public.user_permissions up
    WHERE up.user_id = _user_id
      AND up.resource = 'crm'
      AND up.permission_level <> 'none'
  )
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_consorcio_pii(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_consorcio_pii(uuid) TO authenticated, service_role;

-- 3. consortium_cards: replace blanket authenticated policies with role-scoped ones
DROP POLICY IF EXISTS "Authenticated users can view consortium_cards" ON public.consortium_cards;
DROP POLICY IF EXISTS "Authenticated users can insert consortium_cards" ON public.consortium_cards;
DROP POLICY IF EXISTS "Authenticated users can update consortium_cards" ON public.consortium_cards;
DROP POLICY IF EXISTS "Authenticated users can delete consortium_cards" ON public.consortium_cards;

CREATE POLICY "Consorcio staff can view consortium_cards"
ON public.consortium_cards FOR SELECT TO authenticated
USING (public.can_access_consorcio_pii(auth.uid()));

CREATE POLICY "Consorcio staff can insert consortium_cards"
ON public.consortium_cards FOR INSERT TO authenticated
WITH CHECK (public.can_access_consorcio_pii(auth.uid()));

CREATE POLICY "Consorcio staff can update consortium_cards"
ON public.consortium_cards FOR UPDATE TO authenticated
USING (public.can_access_consorcio_pii(auth.uid()))
WITH CHECK (public.can_access_consorcio_pii(auth.uid()));

CREATE POLICY "Consorcio staff can delete consortium_cards"
ON public.consortium_cards FOR DELETE TO authenticated
USING (public.can_access_consorcio_pii(auth.uid()));

-- 4. consorcio_pending_registrations: scope the open SELECT
DROP POLICY IF EXISTS "Authenticated users can view pending registrations" ON public.consorcio_pending_registrations;

CREATE POLICY "Consorcio staff can view pending registrations"
ON public.consorcio_pending_registrations FOR SELECT TO authenticated
USING (public.can_access_consorcio_pii(auth.uid()));