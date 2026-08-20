-- remove overriding broad policies
DROP POLICY IF EXISTS "Authenticated users can view receivables" ON public.billing_payment_receivables;
DROP POLICY IF EXISTS "Authenticated users can insert receivables" ON public.billing_payment_receivables;
DROP POLICY IF EXISTS "Authenticated users can update receivables" ON public.billing_payment_receivables;
DROP POLICY IF EXISTS "Authenticated users can delete receivables" ON public.billing_payment_receivables;

DROP POLICY IF EXISTS "Authenticated users can view boletos" ON public.consorcio_boletos;
DROP POLICY IF EXISTS "Authenticated users can insert boletos" ON public.consorcio_boletos;
DROP POLICY IF EXISTS "Authenticated users can update boletos" ON public.consorcio_boletos;
DROP POLICY IF EXISTS "Authenticated users can delete boletos" ON public.consorcio_boletos;

-- consortium_installments
DROP POLICY IF EXISTS "Authenticated users can view consortium_installments" ON public.consortium_installments;
DROP POLICY IF EXISTS "Authenticated users can insert consortium_installments" ON public.consortium_installments;
DROP POLICY IF EXISTS "Authenticated users can update consortium_installments" ON public.consortium_installments;
DROP POLICY IF EXISTS "Authenticated users can delete consortium_installments" ON public.consortium_installments;
CREATE POLICY "Consorcio staff can view consortium_installments" ON public.consortium_installments FOR SELECT TO authenticated USING (public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can insert consortium_installments" ON public.consortium_installments FOR INSERT TO authenticated WITH CHECK (public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can update consortium_installments" ON public.consortium_installments FOR UPDATE TO authenticated USING (public.can_access_consorcio_pii(auth.uid())) WITH CHECK (public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can delete consortium_installments" ON public.consortium_installments FOR DELETE TO authenticated USING (public.can_access_consorcio_pii(auth.uid()));

-- credit module: align with credit_clients/credit_partners (admin/manager)
DROP POLICY IF EXISTS "Authenticated users can read credit_deals" ON public.credit_deals;
DROP POLICY IF EXISTS "Authenticated users can insert credit_deals" ON public.credit_deals;
DROP POLICY IF EXISTS "Authenticated users can update credit_deals" ON public.credit_deals;
DROP POLICY IF EXISTS "Authenticated users can delete credit_deals" ON public.credit_deals;
CREATE POLICY "Managers can manage credit_deals" ON public.credit_deals FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "Authenticated users can read credit_partner_deals" ON public.credit_partner_deals;
DROP POLICY IF EXISTS "Authenticated users can insert credit_partner_deals" ON public.credit_partner_deals;
DROP POLICY IF EXISTS "Authenticated users can update credit_partner_deals" ON public.credit_partner_deals;
CREATE POLICY "Managers can manage credit_partner_deals" ON public.credit_partner_deals FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "Authenticated users can read credit_deal_activities" ON public.credit_deal_activities;
DROP POLICY IF EXISTS "Authenticated users can insert credit_deal_activities" ON public.credit_deal_activities;
CREATE POLICY "Managers can manage credit_deal_activities" ON public.credit_deal_activities FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));