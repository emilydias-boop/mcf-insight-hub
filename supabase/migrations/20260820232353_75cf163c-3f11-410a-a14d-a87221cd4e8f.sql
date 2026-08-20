-- employee_compliance
DROP POLICY IF EXISTS "Authenticated users can read compliance" ON public.employee_compliance;
DROP POLICY IF EXISTS "Authenticated users can insert compliance" ON public.employee_compliance;
DROP POLICY IF EXISTS "Authenticated users can update compliance" ON public.employee_compliance;
DROP POLICY IF EXISTS "Authenticated users can delete compliance" ON public.employee_compliance;

CREATE POLICY "RH e Admin podem gerenciar compliance"
ON public.employee_compliance FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'rh'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'rh'::app_role));

CREATE POLICY "Colaborador pode ver seu compliance"
ON public.employee_compliance FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.employees e
  WHERE e.id = employee_compliance.employee_id AND e.user_id = auth.uid()
));

-- employee_time_records
DROP POLICY IF EXISTS "Authenticated users can read time records" ON public.employee_time_records;
DROP POLICY IF EXISTS "Authenticated users can insert time records" ON public.employee_time_records;
DROP POLICY IF EXISTS "Authenticated users can update time records" ON public.employee_time_records;
DROP POLICY IF EXISTS "Authenticated users can delete time records" ON public.employee_time_records;

CREATE POLICY "RH e Admin podem gerenciar time records"
ON public.employee_time_records FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'rh'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'rh'::app_role));

CREATE POLICY "Colaborador pode ver seus time records"
ON public.employee_time_records FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.employees e
  WHERE e.id = employee_time_records.employee_id AND e.user_id = auth.uid()
));