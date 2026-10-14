CREATE TABLE public.clima_pesquisas (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), titulo text NOT NULL, descricao text, ativa boolean NOT NULL DEFAULT false, created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.clima_perguntas (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pesquisa_id uuid NOT NULL REFERENCES public.clima_pesquisas(id) ON DELETE CASCADE, ordem int NOT NULL DEFAULT 0, enunciado text NOT NULL, tipo text NOT NULL DEFAULT 'escala_0_10', permite_comentario boolean NOT NULL DEFAULT false, obrigatoria boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT clima_tipo_ok CHECK (tipo IN ('escala_0_10','texto')));
CREATE TABLE public.clima_respostas (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pesquisa_id uuid NOT NULL REFERENCES public.clima_pesquisas(id) ON DELETE CASCADE, user_id uuid NOT NULL DEFAULT auth.uid(), respostas jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (pesquisa_id, user_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clima_pesquisas, public.clima_perguntas, public.clima_respostas TO authenticated;
GRANT ALL ON public.clima_pesquisas, public.clima_perguntas, public.clima_respostas TO service_role;

ALTER TABLE public.clima_pesquisas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clima_perguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clima_respostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY clima_pesq_admin ON public.clima_pesquisas FOR ALL TO authenticated USING (public.academia_is_admin()) WITH CHECK (public.academia_is_admin());
CREATE POLICY clima_pesq_ler_ativa ON public.clima_pesquisas FOR SELECT TO authenticated USING (ativa);
CREATE POLICY clima_perg_admin ON public.clima_perguntas FOR ALL TO authenticated USING (public.academia_is_admin()) WITH CHECK (public.academia_is_admin());
CREATE POLICY clima_perg_ler_ativa ON public.clima_perguntas FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.clima_pesquisas p WHERE p.id = pesquisa_id AND p.ativa));
CREATE POLICY clima_resp_admin_ler ON public.clima_respostas FOR SELECT TO authenticated USING (public.academia_is_admin());
CREATE POLICY clima_resp_admin_apagar ON public.clima_respostas FOR DELETE TO authenticated USING (public.academia_is_admin());
CREATE POLICY clima_resp_propria_ler ON public.clima_respostas FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY clima_resp_propria_criar ON public.clima_respostas FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.clima_pesquisas p WHERE p.id = pesquisa_id AND p.ativa));

CREATE OR REPLACE FUNCTION public.clima_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER clima_pesq_touch BEFORE UPDATE ON public.clima_pesquisas FOR EACH ROW EXECUTE FUNCTION public.clima_touch();
CREATE TRIGGER clima_perg_touch BEFORE UPDATE ON public.clima_perguntas FOR EACH ROW EXECUTE FUNCTION public.clima_touch();
CREATE TRIGGER clima_resp_touch BEFORE UPDATE ON public.clima_respostas FOR EACH ROW EXECUTE FUNCTION public.clima_touch();

CREATE OR REPLACE FUNCTION public.clima_unica_ativa() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN IF NEW.ativa THEN UPDATE public.clima_pesquisas SET ativa = false WHERE id <> NEW.id AND ativa; END IF; RETURN NEW; END; $$;
CREATE TRIGGER clima_pesq_unica_ativa AFTER INSERT OR UPDATE OF ativa ON public.clima_pesquisas FOR EACH ROW WHEN (NEW.ativa) EXECUTE FUNCTION public.clima_unica_ativa();
REVOKE EXECUTE ON FUNCTION public.clima_unica_ativa() FROM PUBLIC, anon, authenticated;

WITH p AS (INSERT INTO public.clima_pesquisas (titulo, descricao, ativa) VALUES ('Pesquisa de Clima — Padrão', 'Conte como você se sente na MCF. Suas respostas são lidas apenas por Pessoas & Cultura.', false) RETURNING id)
INSERT INTO public.clima_perguntas (pesquisa_id, ordem, enunciado, tipo, permite_comentario, obrigatoria)
SELECT p.id, v.ordem, v.enunciado, v.tipo, v.com, v.obr FROM p, (VALUES
 (1, 'Você se sente confortável e satisfeito com o cargo/função que exerce na MCF?', 'escala_0_10', false, true),
 (2, 'Você tem a intenção de realizar alguma outra função dentro do quadro de cargos e oportunidades da MCF? Se sim, qual área desejaria trabalhar e por que realizar essa função lá?', 'escala_0_10', true, true),
 (3, 'Dedique aqui algumas informações sobre sua trajetória e como gostaria de estar dentro de 6 meses e 1 ano, levando em consideração o que você faz, a sua remuneração e o que você conquistou na vida até agora.', 'texto', false, true)
) AS v(ordem, enunciado, tipo, com, obr);