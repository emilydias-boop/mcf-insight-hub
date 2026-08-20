-- ar_reembolsos
DROP POLICY IF EXISTS "ar_reembolsos_authenticated_all" ON public.ar_reembolsos;
CREATE POLICY "ar_reembolsos_manage" ON public.ar_reembolsos FOR ALL TO authenticated
USING (public.can_manage_ar(auth.uid())) WITH CHECK (public.can_manage_ar(auth.uid()));

-- billing_payment_receivables
DROP POLICY IF EXISTS "Authenticated users can manage billing_payment_receivables" ON public.billing_payment_receivables;
DROP POLICY IF EXISTS "Authenticated users can view billing_payment_receivables" ON public.billing_payment_receivables;
DROP POLICY IF EXISTS "Authenticated users can insert billing_payment_receivables" ON public.billing_payment_receivables;
DROP POLICY IF EXISTS "Authenticated users can update billing_payment_receivables" ON public.billing_payment_receivables;
DROP POLICY IF EXISTS "Authenticated users can delete billing_payment_receivables" ON public.billing_payment_receivables;
CREATE POLICY "Finance can manage billing_payment_receivables" ON public.billing_payment_receivables FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro'));

-- consorcio_boletos
DROP POLICY IF EXISTS "Authenticated users can view consorcio_boletos" ON public.consorcio_boletos;
DROP POLICY IF EXISTS "Authenticated users can insert consorcio_boletos" ON public.consorcio_boletos;
DROP POLICY IF EXISTS "Authenticated users can update consorcio_boletos" ON public.consorcio_boletos;
DROP POLICY IF EXISTS "Authenticated users can delete consorcio_boletos" ON public.consorcio_boletos;
CREATE POLICY "Consorcio staff can view consorcio_boletos" ON public.consorcio_boletos FOR SELECT TO authenticated USING (public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can insert consorcio_boletos" ON public.consorcio_boletos FOR INSERT TO authenticated WITH CHECK (public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can update consorcio_boletos" ON public.consorcio_boletos FOR UPDATE TO authenticated USING (public.can_access_consorcio_pii(auth.uid())) WITH CHECK (public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can delete consorcio_boletos" ON public.consorcio_boletos FOR DELETE TO authenticated USING (public.can_access_consorcio_pii(auth.uid()));