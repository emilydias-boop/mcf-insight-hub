CREATE TABLE public.ar_metas_cobranca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes date NOT NULL,
  cobrador_id uuid,
  valor numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ar_metas_cobranca_uk ON public.ar_metas_cobranca (mes, COALESCE(cobrador_id, '00000000-0000-0000-0000-000000000000'::uuid));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ar_metas_cobranca TO authenticated;
GRANT ALL ON public.ar_metas_cobranca TO service_role;
ALTER TABLE public.ar_metas_cobranca ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AR pode ver metas" ON public.ar_metas_cobranca FOR SELECT TO authenticated
  USING (public.can_manage_ar(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'));
CREATE POLICY "Admin gerencia metas" ON public.ar_metas_cobranca FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER ar_metas_cobranca_updated BEFORE UPDATE ON public.ar_metas_cobranca
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.ar_metas_cobranca (mes, cobrador_id, valor) VALUES ('2026-11-01', NULL, 250000);