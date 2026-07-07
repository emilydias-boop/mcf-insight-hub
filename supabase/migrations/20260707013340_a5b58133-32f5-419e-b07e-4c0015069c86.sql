-- ar_titulos
DROP POLICY IF EXISTS "Financeiro e admin gerenciam titulos AR" ON public.ar_titulos;
CREATE POLICY "Admin gerencia titulos AR" ON public.ar_titulos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- ar_parcelas
DROP POLICY IF EXISTS "Financeiro e admin gerenciam parcelas AR" ON public.ar_parcelas;
CREATE POLICY "Admin gerencia parcelas AR" ON public.ar_parcelas
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- ar_historico
DROP POLICY IF EXISTS "Financeiro e admin veem historico AR" ON public.ar_historico;
DROP POLICY IF EXISTS "Financeiro e admin inserem historico AR" ON public.ar_historico;
CREATE POLICY "Admin ve historico AR" ON public.ar_historico
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admin insere historico AR" ON public.ar_historico
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));