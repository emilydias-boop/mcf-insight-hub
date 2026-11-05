CREATE TABLE public.jornada_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem integer NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  titulo text NOT NULL,
  descricao text,
  icone text,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jornada_etapas TO authenticated;
GRANT ALL ON public.jornada_etapas TO service_role;
ALTER TABLE public.jornada_etapas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jornada_etapas leitura" ON public.jornada_etapas FOR SELECT TO authenticated USING (true);
CREATE POLICY "jornada_etapas admin insere" ON public.jornada_etapas FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "jornada_etapas admin edita" ON public.jornada_etapas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.jornada_etapas (ordem, slug, titulo, descricao, icone) VALUES
 (10,'compra','Compra','Início da sua jornada com a MCF Capital','shopping-bag'),
 (20,'onboarding','Boas-vindas','Ligação da nossa equipe de boas-vindas','phone'),
 (30,'cadastro_harvey','Cadastro no HARVEY','Seu acesso ao ecossistema que gerencia sua execução na MCF','layout-dashboard');

ALTER TABLE public.crm_deals
  ADD COLUMN IF NOT EXISTS jornada_etapa_atual_id uuid REFERENCES public.jornada_etapas(id),
  ADD COLUMN IF NOT EXISTS data_compra date,
  ADD COLUMN IF NOT EXISTS cpf text;
CREATE INDEX IF NOT EXISTS crm_deals_cpf_idx ON public.crm_deals (cpf) WHERE cpf IS NOT NULL;

CREATE TABLE public.jornada_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  etapa_id uuid NOT NULL REFERENCES public.jornada_etapas(id),
  ocorrido_em timestamptz NOT NULL DEFAULT now(),
  registrado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  observacao text
);
CREATE INDEX jornada_eventos_deal_idx ON public.jornada_eventos (deal_id, ocorrido_em DESC);
GRANT SELECT ON public.jornada_eventos TO authenticated;
GRANT ALL ON public.jornada_eventos TO service_role;
ALTER TABLE public.jornada_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jornada_eventos leitura" ON public.jornada_eventos FOR SELECT TO authenticated USING (true);

-- Etapa-alvo automática (só avança). Retorna NULL se não houver avanço.
CREATE OR REPLACE FUNCTION public.jornada_etapa_alvo(p_deal uuid, p_stage uuid, p_owner uuid, p_cf jsonb, p_atual uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ord_atual int := -1; v_alvo uuid; v_slugs text[] := '{}';
BEGIN
  IF p_atual IS NOT NULL THEN SELECT ordem INTO v_ord_atual FROM jornada_etapas WHERE id = p_atual; END IF;
  IF jsonb_typeof(p_cf->'pos_venda_compras') = 'array' AND jsonb_array_length(p_cf->'pos_venda_compras') > 0 THEN
    v_slugs := v_slugs || 'compra'; END IF;
  IF p_stage = 'b05a0001-0000-4000-8000-000000000000'::uuid AND p_owner IS NOT NULL
     AND EXISTS (SELECT 1 FROM deal_activities WHERE deal_id = p_deal::text AND activity_type = 'pos_venda_nota_contato') THEN
    v_slugs := v_slugs || 'onboarding'; END IF;
  IF coalesce(nullif(trim(p_cf->>'harvey_cliente_id'),''), NULL) IS NOT NULL THEN
    v_slugs := v_slugs || 'cadastro_harvey'; END IF;
  SELECT id INTO v_alvo FROM jornada_etapas
   WHERE ativa AND slug = ANY(v_slugs) AND ordem > coalesce(v_ord_atual,-1)
   ORDER BY ordem DESC LIMIT 1;
  RETURN v_alvo;
END $$;

CREATE OR REPLACE FUNCTION public.jornada_tg_deal_before()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_alvo uuid; v_cpf text; v_pago timestamptz;
BEGIN
  BEGIN
    v_cpf := nullif(regexp_replace(coalesce(NEW.custom_fields->>'cpf',''),'\D','','g'),'');
    IF v_cpf IS NOT NULL AND length(v_cpf) <= 11 THEN NEW.cpf := lpad(v_cpf,11,'0'); END IF;
    IF NEW.data_compra IS NULL AND jsonb_typeof(NEW.custom_fields->'pos_venda_compras') = 'array' THEN
      SELECT min((e->>'pago_em')::timestamptz) INTO v_pago FROM jsonb_array_elements(NEW.custom_fields->'pos_venda_compras') e WHERE e->>'pago_em' IS NOT NULL;
      IF v_pago IS NOT NULL THEN NEW.data_compra := (v_pago AT TIME ZONE 'America/Sao_Paulo')::date; END IF;
    END IF;
    -- mudança manual da etapa: respeita
    IF TG_OP = 'UPDATE' AND OLD.jornada_etapa_atual_id IS DISTINCT FROM NEW.jornada_etapa_atual_id THEN RETURN NEW; END IF;
    v_alvo := jornada_etapa_alvo(NEW.id, NEW.stage_id, NEW.owner_profile_id, NEW.custom_fields, NEW.jornada_etapa_atual_id);
    IF v_alvo IS NOT NULL THEN NEW.jornada_etapa_atual_id := v_alvo; END IF;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'jornada (deal %): %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.jornada_tg_deal_evento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_quando timestamptz := now(); v_slug text; v_manual boolean := current_setting('jornada.manual', true) = '1'; v_pago timestamptz;
BEGIN
  BEGIN
    IF NEW.jornada_etapa_atual_id IS NULL THEN RETURN NULL; END IF;
    IF TG_OP = 'UPDATE' AND OLD.jornada_etapa_atual_id IS NOT DISTINCT FROM NEW.jornada_etapa_atual_id THEN RETURN NULL; END IF;
    SELECT slug INTO v_slug FROM jornada_etapas WHERE id = NEW.jornada_etapa_atual_id;
    IF v_slug = 'compra' AND NOT v_manual AND jsonb_typeof(NEW.custom_fields->'pos_venda_compras') = 'array' THEN
      SELECT min((e->>'pago_em')::timestamptz) INTO v_pago FROM jsonb_array_elements(NEW.custom_fields->'pos_venda_compras') e WHERE e->>'pago_em' IS NOT NULL;
      v_quando := coalesce(v_pago, now());
    END IF;
    INSERT INTO jornada_eventos (deal_id, etapa_id, ocorrido_em, registrado_por, observacao)
    VALUES (NEW.id, NEW.jornada_etapa_atual_id, v_quando,
      CASE WHEN v_manual THEN auth.uid() END,
      CASE WHEN v_manual THEN nullif(current_setting('jornada.obs', true),'') ELSE 'Automático' END);
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'jornada evento (deal %): %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_jornada_deal_ins BEFORE INSERT ON public.crm_deals FOR EACH ROW
  WHEN (NEW.origin_id = 'b05a0000-0000-4000-8000-000000000002'::uuid) EXECUTE FUNCTION public.jornada_tg_deal_before();
CREATE TRIGGER trg_jornada_deal_upd BEFORE UPDATE OF custom_fields, owner_profile_id, stage_id, jornada_etapa_atual_id ON public.crm_deals FOR EACH ROW
  WHEN (NEW.origin_id = 'b05a0000-0000-4000-8000-000000000002'::uuid) EXECUTE FUNCTION public.jornada_tg_deal_before();
CREATE TRIGGER trg_jornada_evento AFTER INSERT OR UPDATE OF jornada_etapa_atual_id ON public.crm_deals FOR EACH ROW
  WHEN (NEW.origin_id = 'b05a0000-0000-4000-8000-000000000002'::uuid) EXECUTE FUNCTION public.jornada_tg_deal_evento();

-- Anotação de contato pode concluir as Boas-vindas
CREATE OR REPLACE FUNCTION public.jornada_tg_nota()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d record; v_alvo uuid;
BEGIN
  BEGIN
    SELECT id, stage_id, owner_profile_id, custom_fields, jornada_etapa_atual_id INTO d
      FROM crm_deals WHERE id::text = NEW.deal_id AND origin_id = 'b05a0000-0000-4000-8000-000000000002'::uuid;
    IF d.id IS NULL THEN RETURN NULL; END IF;
    v_alvo := jornada_etapa_alvo(d.id, d.stage_id, d.owner_profile_id, d.custom_fields, d.jornada_etapa_atual_id);
    IF v_alvo IS NOT NULL THEN UPDATE crm_deals SET jornada_etapa_atual_id = v_alvo WHERE id = d.id; END IF;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'jornada nota: %', SQLERRM;
  END;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_jornada_nota AFTER INSERT ON public.deal_activities FOR EACH ROW
  WHEN (NEW.activity_type = 'pos_venda_nota_contato') EXECUTE FUNCTION public.jornada_tg_nota();

-- Mudança manual
CREATE OR REPLACE FUNCTION public.jornada_definir_etapa(p_deal_id uuid, p_etapa_id uuid, p_observacao text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerente_relacionamento')) THEN
    RAISE EXCEPTION 'sem permissão' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM crm_deals WHERE id = p_deal_id AND origin_id = 'b05a0000-0000-4000-8000-000000000002'::uuid) THEN
    RAISE EXCEPTION 'cartão não é do Pós-Venda'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jornada_etapas WHERE id = p_etapa_id) THEN RAISE EXCEPTION 'etapa inválida'; END IF;
  PERFORM set_config('jornada.manual','1', true);
  PERFORM set_config('jornada.obs', left(coalesce(p_observacao,''),500), true);
  UPDATE crm_deals SET jornada_etapa_atual_id = p_etapa_id WHERE id = p_deal_id AND jornada_etapa_atual_id IS DISTINCT FROM p_etapa_id;
  IF NOT FOUND THEN
    INSERT INTO jornada_eventos (deal_id, etapa_id, registrado_por, observacao)
    VALUES (p_deal_id, p_etapa_id, auth.uid(), nullif(p_observacao,''));
  END IF;
  PERFORM set_config('jornada.manual','0', true);
END $$;
REVOKE ALL ON FUNCTION public.jornada_definir_etapa(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.jornada_definir_etapa(uuid,uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.jornada_etapa_alvo(uuid,uuid,uuid,jsonb,uuid) FROM PUBLIC, anon;