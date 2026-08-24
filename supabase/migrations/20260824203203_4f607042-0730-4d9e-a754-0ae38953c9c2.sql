ALTER TABLE public.consorcio_produtos
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS updated_by uuid;

REVOKE INSERT, UPDATE, DELETE ON public.consorcio_produtos FROM anon;
GRANT SELECT ON public.consorcio_produtos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consorcio_produtos TO authenticated;
GRANT ALL ON public.consorcio_produtos TO service_role;

CREATE POLICY "Admins managers e cobranca consorcio inserem produtos"
ON public.consorcio_produtos
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'cobranca_consorcio'::app_role)
);

CREATE POLICY "Admins managers e cobranca consorcio atualizam produtos"
ON public.consorcio_produtos
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'cobranca_consorcio'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'cobranca_consorcio'::app_role)
);

CREATE POLICY "Admins managers e cobranca consorcio excluem produtos"
ON public.consorcio_produtos
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'cobranca_consorcio'::app_role)
);

CREATE OR REPLACE FUNCTION public.set_consorcio_produto_updated_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_consorcio_produtos_updated_by
BEFORE UPDATE ON public.consorcio_produtos
FOR EACH ROW
EXECUTE FUNCTION public.set_consorcio_produto_updated_by();