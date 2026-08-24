CREATE TABLE public.consorcio_planos_faltando_ignorados (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  combinacao_key text NOT NULL,
  ignorado_por uuid NULL DEFAULT auth.uid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT consorcio_planos_faltando_ignorados_key_unique UNIQUE (combinacao_key)
);

GRANT SELECT ON public.consorcio_planos_faltando_ignorados TO authenticated;
GRANT INSERT, DELETE ON public.consorcio_planos_faltando_ignorados TO authenticated;
GRANT ALL ON public.consorcio_planos_faltando_ignorados TO service_role;

ALTER TABLE public.consorcio_planos_faltando_ignorados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados podem ler sugestoes ignoradas"
ON public.consorcio_planos_faltando_ignorados
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins managers e cobranca consorcio ignoram sugestoes"
ON public.consorcio_planos_faltando_ignorados
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'cobranca_consorcio'::app_role)
);

CREATE POLICY "Admins managers e cobranca consorcio restauram sugestoes"
ON public.consorcio_planos_faltando_ignorados
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'cobranca_consorcio'::app_role)
);

CREATE INDEX idx_consorcio_planos_faltando_ignorados_key
ON public.consorcio_planos_faltando_ignorados (combinacao_key);