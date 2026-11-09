ALTER TABLE public.ar_titulos ADD COLUMN IF NOT EXISTS negociacao boolean NOT NULL DEFAULT false;
ALTER TABLE public.ar_parcelas ADD COLUMN IF NOT EXISTS evento text, ADD COLUMN IF NOT EXISTS cobrador_id uuid;

CREATE TABLE public.ar_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ar_eventos TO authenticated;
GRANT ALL ON public.ar_eventos TO service_role;
ALTER TABLE public.ar_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Financeiro lê eventos AR" ON public.ar_eventos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "Gestores AR gerenciam eventos" ON public.ar_eventos FOR ALL TO authenticated
  USING (public.can_manage_ar(auth.uid())) WITH CHECK (public.can_manage_ar(auth.uid()));
INSERT INTO public.ar_eventos (nome, created_by) VALUES ('Cobrança regular', NULL), ('Ação Quite Já 2026', NULL);

CREATE TABLE public.ar_notas_gerais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  texto text NOT NULL,
  autor_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ar_notas_gerais TO authenticated;
GRANT ALL ON public.ar_notas_gerais TO service_role;
ALTER TABLE public.ar_notas_gerais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Financeiro lê notas AR" ON public.ar_notas_gerais FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "Financeiro cria notas AR" ON public.ar_notas_gerais FOR INSERT TO authenticated
  WITH CHECK (autor_id = auth.uid() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro')));
CREATE POLICY "Autor ou gestor edita notas AR" ON public.ar_notas_gerais FOR UPDATE TO authenticated
  USING (autor_id = auth.uid() OR public.can_manage_ar(auth.uid()));
CREATE POLICY "Autor ou gestor exclui notas AR" ON public.ar_notas_gerais FOR DELETE TO authenticated
  USING (autor_id = auth.uid() OR public.can_manage_ar(auth.uid()));
CREATE TRIGGER trg_ar_notas_gerais_updated BEFORE UPDATE ON public.ar_notas_gerais
  FOR EACH ROW EXECUTE FUNCTION public.ar_touch_updated_at();