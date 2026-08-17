DROP POLICY IF EXISTS "Staff or owner can update termos" ON public.consorcio_termos;

CREATE POLICY "Staff or owner can cancel termos"
ON public.consorcio_termos
FOR UPDATE
TO authenticated
USING (
  status = 'pendente'
  AND (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'coordenador') OR public.has_role(auth.uid(),'assistente_administrativo')
    OR created_by = auth.uid()
  )
)
WITH CHECK (
  status IN ('pendente','cancelado')
  AND assinado_em IS NULL
  AND assinante_nome IS NULL
  AND assinante_cpf IS NULL
  AND assinante_ip IS NULL
  AND assinante_user_agent IS NULL
);

DROP POLICY IF EXISTS "Managers can insert termo modelos" ON public.consorcio_termo_modelos;
DROP POLICY IF EXISTS "Managers can update termo modelos" ON public.consorcio_termo_modelos;
DROP POLICY IF EXISTS "Managers can delete termo modelos" ON public.consorcio_termo_modelos;

CREATE POLICY "Admins can insert termo modelos"
  ON public.consorcio_termo_modelos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "Admins can update termo modelos"
  ON public.consorcio_termo_modelos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "Admins can delete termo modelos"
  ON public.consorcio_termo_modelos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));