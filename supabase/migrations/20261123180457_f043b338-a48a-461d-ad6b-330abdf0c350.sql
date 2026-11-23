CREATE TABLE public.documentos_internos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  arquivo_path text,
  arquivo_url text,
  versao integer NOT NULL DEFAULT 1,
  exige_aceite boolean NOT NULL DEFAULT false,
  texto_aceite text,
  ativo boolean NOT NULL DEFAULT true,
  publicado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.documentos_internos TO authenticated;
GRANT ALL ON public.documentos_internos TO service_role;
ALTER TABLE public.documentos_internos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docint_select" ON public.documentos_internos FOR SELECT TO authenticated USING (true);
CREATE POLICY "docint_insert" ON public.documentos_internos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'rh'));
CREATE POLICY "docint_update" ON public.documentos_internos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'rh'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'rh'));
CREATE TRIGGER trg_docint_updated BEFORE UPDATE ON public.documentos_internos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.documentos_internos_aceites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES public.documentos_internos(id),
  versao integer NOT NULL,
  user_id uuid NOT NULL,
  employee_id uuid,
  user_email text,
  aceito_em timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  texto_confirmado text NOT NULL,
  UNIQUE (documento_id, versao, user_id)
);
GRANT SELECT ON public.documentos_internos_aceites TO authenticated;
GRANT ALL ON public.documentos_internos_aceites TO service_role;
ALTER TABLE public.documentos_internos_aceites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docace_select" ON public.documentos_internos_aceites FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'rh'));

CREATE OR REPLACE FUNCTION public.documentos_pendentes_aceite()
RETURNS SETOF public.documentos_internos
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT d.* FROM public.documentos_internos d
  WHERE d.ativo AND d.exige_aceite AND auth.uid() IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.documentos_internos_aceites a
      WHERE a.documento_id = d.id AND a.versao = d.versao AND a.user_id = auth.uid())
  ORDER BY d.created_at;
$$;

CREATE OR REPLACE FUNCTION public.registrar_aceite_documento(_documento_id uuid, _user_agent text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.documentos_internos; emp uuid; em text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  SELECT * INTO d FROM public.documentos_internos WHERE id = _documento_id AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'documento não encontrado'; END IF;
  SELECT email INTO em FROM auth.users WHERE id = auth.uid();
  SELECT id INTO emp FROM public.employees WHERE user_id = auth.uid() LIMIT 1;
  IF emp IS NULL THEN
    SELECT e.id INTO emp FROM public.employees e WHERE e.profile_id = auth.uid() LIMIT 1;
  END IF;
  INSERT INTO public.documentos_internos_aceites(documento_id, versao, user_id, employee_id, user_email, user_agent, texto_confirmado)
  VALUES (d.id, d.versao, auth.uid(), emp, em, left(_user_agent, 500),
          coalesce(d.texto_aceite, 'Li e entendi o documento'))
  ON CONFLICT (documento_id, versao, user_id) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.registrar_aceite_documento(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.registrar_aceite_documento(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.documentos_pendentes_aceite() TO authenticated;

CREATE TABLE public.avisos_gerais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  mensagem text NOT NULL,
  nivel text NOT NULL DEFAULT 'informativo',
  ativo boolean NOT NULL DEFAULT true,
  enviado_por uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.avisos_gerais TO authenticated;
GRANT ALL ON public.avisos_gerais TO service_role;
ALTER TABLE public.avisos_gerais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "avisos_select" ON public.avisos_gerais FOR SELECT TO authenticated USING (true);
CREATE POLICY "avisos_insert" ON public.avisos_gerais FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') AND enviado_por = auth.uid());
CREATE POLICY "avisos_update" ON public.avisos_gerais FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_avisos_updated BEFORE UPDATE ON public.avisos_gerais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.avisos_gerais_ciencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aviso_id uuid NOT NULL REFERENCES public.avisos_gerais(id),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  ciente_em timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  UNIQUE (aviso_id, user_id)
);
GRANT SELECT, INSERT ON public.avisos_gerais_ciencias TO authenticated;
GRANT ALL ON public.avisos_gerais_ciencias TO service_role;
ALTER TABLE public.avisos_gerais_ciencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cien_select" ON public.avisos_gerais_ciencias FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "cien_insert" ON public.avisos_gerais_ciencias FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.avisos_gerais;

CREATE POLICY "docint_storage_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos-internos');
CREATE POLICY "docint_storage_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos-internos' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'rh')));

INSERT INTO public.documentos_internos (titulo, descricao, arquivo_path, versao, exige_aceite, texto_aceite)
VALUES ('Manual de Conduta MCF Capital', 'Normas de conduta para todos os colaboradores.',
        'manual-de-conduta/Manual_de_Conduta_MCF_v1.pdf', 1, true,
        'Li e entendi o manual de conduta da MCF CAPITAL');