-- =====================================================
-- FIX RLS POLICIES FOR PATRIMÔNIO MODULE
-- Drop policies FIRST, then function, then recreate
-- =====================================================

-- A) Drop existing policies FIRST (before dropping function)
DROP POLICY IF EXISTS "Admin/Manager full access on assets" ON public.assets;
DROP POLICY IF EXISTS "Users can view their assigned assets" ON public.assets;

DROP POLICY IF EXISTS "Admin/Manager full access on asset_assignments" ON public.asset_assignments;
DROP POLICY IF EXISTS "Users can view their own assignments" ON public.asset_assignments;

DROP POLICY IF EXISTS "Admin/Manager full access on asset_assignment_items" ON public.asset_assignment_items;
DROP POLICY IF EXISTS "Users can view their own assignment items" ON public.asset_assignment_items;

DROP POLICY IF EXISTS "Admin/Manager full access on asset_terms" ON public.asset_terms;
DROP POLICY IF EXISTS "Users can view their own terms" ON public.asset_terms;
DROP POLICY IF EXISTS "Users can accept their own terms" ON public.asset_terms;

DROP POLICY IF EXISTS "Admin/Manager full access on asset_history" ON public.asset_history;
DROP POLICY IF EXISTS "Users can view history of their assets" ON public.asset_history;

-- B) Now drop the incorrect get_user_role() function (no parameters)
DROP FUNCTION IF EXISTS public.get_user_role();

-- =====================================================
-- RECREATE POLICIES USING has_role()
-- =====================================================

-- ASSETS TABLE
CREATE POLICY "Admin/Manager full access on assets"
ON public.assets
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Users can view their assigned assets"
ON public.assets
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT aa.asset_id FROM public.asset_assignments aa
    JOIN public.employees e ON e.id = aa.employee_id
    WHERE e.user_id = auth.uid()
  )
);

-- ASSET_ASSIGNMENTS TABLE
CREATE POLICY "Admin/Manager full access on asset_assignments"
ON public.asset_assignments
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Users can view their own assignments"
ON public.asset_assignments
FOR SELECT
TO authenticated
USING (
  employee_id IN (
    SELECT id FROM public.employees WHERE user_id = auth.uid()
  )
);

-- ASSET_ASSIGNMENT_ITEMS TABLE
CREATE POLICY "Admin/Manager full access on asset_assignment_items"
ON public.asset_assignment_items
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Users can view their own assignment items"
ON public.asset_assignment_items
FOR SELECT
TO authenticated
USING (
  assignment_id IN (
    SELECT aa.id FROM public.asset_assignments aa
    JOIN public.employees e ON e.id = aa.employee_id
    WHERE e.user_id = auth.uid()
  )
);

-- ASSET_TERMS TABLE
CREATE POLICY "Admin/Manager full access on asset_terms"
ON public.asset_terms
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Users can view their own terms"
ON public.asset_terms
FOR SELECT
TO authenticated
USING (
  employee_id IN (
    SELECT id FROM public.employees WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can accept their own terms"
ON public.asset_terms
FOR UPDATE
TO authenticated
USING (
  employee_id IN (
    SELECT id FROM public.employees WHERE user_id = auth.uid()
  )
  AND aceito = false
)
WITH CHECK (
  employee_id IN (
    SELECT id FROM public.employees WHERE user_id = auth.uid()
  )
);

-- ASSET_HISTORY TABLE
CREATE POLICY "Admin/Manager full access on asset_history"
ON public.asset_history
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Users can view history of their assets"
ON public.asset_history
FOR SELECT
TO authenticated
USING (
  asset_id IN (
    SELECT aa.asset_id FROM public.asset_assignments aa
    JOIN public.employees e ON e.id = aa.employee_id
    WHERE e.user_id = auth.uid()
  )
);