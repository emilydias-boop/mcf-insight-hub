-- Adiciona suporte ao novo rule_key 'r1_force_paid_lead' no fluxo de aprovações.
-- Permite que admin/manager/coordenador + Jessica Bellini (email allowlist)
-- aprovem solicitações de SDR/Closer para reagendar R1 em leads já pagos.

-- SECURITY DEFINER function — quem pode aprovar liberação de R1 pós-pago
CREATE OR REPLACE FUNCTION public.is_r1_force_approver(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    public.has_role(_uid, 'admin')
    OR public.has_role(_uid, 'manager')
    OR public.has_role(_uid, 'coordenador')
    OR EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = _uid
        AND lower(email) = 'jessica.bellini@minhacasafinanciada.com'
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_r1_force_approver(uuid) TO authenticated, service_role;

-- Policies extras só para r1_force_paid_lead (incluem Jessica via email allowlist).
-- As policies originais de admin/manager/coordenador continuam ativas para os demais rule_keys.
CREATE POLICY "R1 force approvers read r1_force requests"
  ON public.rule_approval_requests FOR SELECT
  USING (
    rule_key = 'r1_force_paid_lead'
    AND public.is_r1_force_approver(auth.uid())
  );

CREATE POLICY "R1 force approvers update r1_force requests"
  ON public.rule_approval_requests FOR UPDATE
  USING (
    rule_key = 'r1_force_paid_lead'
    AND public.is_r1_force_approver(auth.uid())
  )
  WITH CHECK (
    rule_key = 'r1_force_paid_lead'
    AND public.is_r1_force_approver(auth.uid())
  );

-- Índice para buscar pendentes r1_force especificamente
CREATE INDEX IF NOT EXISTS rule_approval_r1_force_pending_idx
  ON public.rule_approval_requests (created_at DESC)
  WHERE rule_key = 'r1_force_paid_lead' AND status = 'pending';