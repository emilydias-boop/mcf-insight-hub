
-- ===== CATÁLOGO =====
CREATE TABLE public.academia_frentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL, slug text NOT NULL UNIQUE, cor text, ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.academia_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  frente_id uuid NOT NULL REFERENCES public.academia_frentes(id) ON DELETE CASCADE,
  nome text NOT NULL, slug text NOT NULL UNIQUE, resumo text, para_quem text, voce_precisa_saber text,
  material text, icone text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.academia_perfis (
  id uuid PRIMARY KEY,
  nome text NOT NULL, cnpj text, email text,
  frente_id uuid REFERENCES public.academia_frentes(id),
  produto_principal_id uuid REFERENCES public.academia_produtos(id),
  funcao text, atuacao_funil text, data_inicio date NOT NULL DEFAULT current_date,
  gestor_id uuid, padrinho_id uuid, avatar_url text,
  nivel text NOT NULL DEFAULT 'Trainee', xp_total int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','em_trilha','concluido','encerrado')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.academia_track_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL, frente_id uuid REFERENCES public.academia_frentes(id) ON DELETE CASCADE,
  versao int NOT NULL DEFAULT 1, publicado boolean NOT NULL DEFAULT true, descricao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.academia_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_template_id uuid NOT NULL REFERENCES public.academia_track_templates(id) ON DELETE CASCADE,
  ordem int NOT NULL DEFAULT 0, codigo text NOT NULL CHECK (codigo IN ('fase_0','fase_1','fase_2','fase_3')),
  titulo text NOT NULL, periodo_label text, dia_inicio int, dia_fim int, foco text, quem_conduz text,
  bloqueante boolean NOT NULL DEFAULT false
);
CREATE TABLE public.academia_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL, produto_id uuid REFERENCES public.academia_produtos(id) ON DELETE SET NULL,
  nivel int NOT NULL DEFAULT 1, nota_minima int NOT NULL DEFAULT 70, tentativas_max int NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.academia_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.academia_quizzes(id) ON DELETE CASCADE,
  ordem int NOT NULL DEFAULT 0, enunciado text NOT NULL, alternativas jsonb NOT NULL DEFAULT '[]',
  correta int NOT NULL, explicacao text
);
CREATE TABLE public.academia_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id uuid NOT NULL REFERENCES public.academia_phases(id) ON DELETE CASCADE,
  ordem int NOT NULL DEFAULT 0, numero_label text, titulo text NOT NULL, objetivo text, janela_label text
);
CREATE TABLE public.academia_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.academia_modules(id) ON DELETE CASCADE,
  ordem int NOT NULL DEFAULT 0, slug text, titulo text NOT NULL, detalhe text, variantes jsonb,
  tipo_validacao text NOT NULL DEFAULT 'auto' CHECK (tipo_validacao IN ('auto','gestor','padrinho','quiz','evidencia','pratica')),
  xp int NOT NULL DEFAULT 10, obrigatoria boolean NOT NULL DEFAULT true,
  produto_id uuid REFERENCES public.academia_produtos(id) ON DELETE SET NULL,
  badge_nivel int, quiz_id uuid REFERENCES public.academia_quizzes(id) ON DELETE SET NULL
);
CREATE TABLE public.academia_user_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.academia_perfis(id) ON DELETE CASCADE,
  track_template_id uuid NOT NULL REFERENCES public.academia_track_templates(id),
  tipo text NOT NULL DEFAULT 'principal' CHECK (tipo IN ('principal','extensao')),
  frente_id uuid REFERENCES public.academia_frentes(id),
  iniciada_em timestamptz NOT NULL DEFAULT now(), concluida_em timestamptz,
  status text NOT NULL DEFAULT 'em_andamento'
);
CREATE UNIQUE INDEX academia_user_tracks_principal ON public.academia_user_tracks(user_id) WHERE tipo='principal';
CREATE UNIQUE INDEX academia_user_tracks_ext ON public.academia_user_tracks(user_id, frente_id) WHERE tipo='extensao';
CREATE TABLE public.academia_user_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_track_id uuid NOT NULL REFERENCES public.academia_user_tracks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES public.academia_tasks(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviada','aprovada','reprovada')),
  marcada_em timestamptz, validada_por uuid, validada_em timestamptz, comentario_validador text,
  evidencia_url text, reprovacoes int NOT NULL DEFAULT 0, enviada_em timestamptz,
  UNIQUE (user_track_id, task_id)
);
CREATE TABLE public.academia_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_track_id uuid NOT NULL REFERENCES public.academia_user_tracks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  codigo text NOT NULL CHECK (codigo IN ('marco_30','conclusao_90')),
  assinatura_gestor_em timestamptz, assinatura_padrinho_em timestamptz, assinatura_colaborador_em timestamptz,
  fechado_em timestamptz, observacoes text, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_track_id, codigo)
);
CREATE TABLE public.academia_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, quiz_id uuid NOT NULL REFERENCES public.academia_quizzes(id) ON DELETE CASCADE,
  nota int NOT NULL, aprovado boolean NOT NULL, respostas jsonb, criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.academia_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE, nome text NOT NULL, descricao text,
  tipo text NOT NULL CHECK (tipo IN ('produto','transversal','mestre')),
  produto_id uuid REFERENCES public.academia_produtos(id) ON DELETE CASCADE,
  nivel int, icone text, cor text, xp_bonus int NOT NULL DEFAULT 0, ordem int NOT NULL DEFAULT 0
);
CREATE TABLE public.academia_badge_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id uuid NOT NULL REFERENCES public.academia_badges(id) ON DELETE CASCADE,
  regra jsonb NOT NULL
);
CREATE TABLE public.academia_user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, badge_id uuid NOT NULL REFERENCES public.academia_badges(id) ON DELETE CASCADE,
  conquistado_em timestamptz NOT NULL DEFAULT now(), evidencia jsonb, UNIQUE (user_id, badge_id)
);
CREATE TABLE public.academia_xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, origem text NOT NULL CHECK (origem IN ('task','quiz','badge','marco')),
  referencia_id uuid NOT NULL, xp int NOT NULL, criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, origem, referencia_id)
);
CREATE TABLE public.academia_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, tipo text, titulo text NOT NULL, corpo text, link text,
  lida boolean NOT NULL DEFAULT false, criado_em timestamptz NOT NULL DEFAULT now()
);

-- ===== GRANTS =====
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['academia_frentes','academia_produtos','academia_perfis','academia_track_templates','academia_phases','academia_modules','academia_tasks','academia_user_tracks','academia_user_tasks','academia_milestones','academia_quizzes','academia_quiz_questions','academia_quiz_attempts','academia_badges','academia_badge_rules','academia_user_badges','academia_xp_events','academia_notifications'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ===== HELPERS =====
CREATE OR REPLACE FUNCTION public.academia_is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'rh')
$$;
CREATE OR REPLACE FUNCTION public.academia_is_gestor_de(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.academia_perfis WHERE id=_uid AND gestor_id=auth.uid())
$$;
CREATE OR REPLACE FUNCTION public.academia_is_padrinho_de(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.academia_perfis WHERE id=_uid AND padrinho_id=auth.uid())
$$;
CREATE OR REPLACE FUNCTION public.academia_pode_ver(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT _uid = auth.uid() OR public.academia_is_admin() OR public.academia_is_gestor_de(_uid) OR public.academia_is_padrinho_de(_uid)
$$;

-- ===== POLICIES =====
-- catálogo: leitura para autenticados, escrita admin
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['academia_frentes','academia_produtos','academia_track_templates','academia_phases','academia_modules','academia_tasks','academia_quizzes','academia_badges','academia_badge_rules'] LOOP
    EXECUTE format('CREATE POLICY "academia_leitura" ON public.%I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "academia_admin_escrita" ON public.%I FOR ALL TO authenticated USING (public.academia_is_admin()) WITH CHECK (public.academia_is_admin())', t);
  END LOOP;
END $$;
-- perguntas: só admin lê direto (resposta correta protegida)
CREATE POLICY "academia_admin_all" ON public.academia_quiz_questions FOR ALL TO authenticated USING (public.academia_is_admin()) WITH CHECK (public.academia_is_admin());
-- perfis
CREATE POLICY "academia_perfis_ver" ON public.academia_perfis FOR SELECT TO authenticated USING (public.academia_pode_ver(id));
CREATE POLICY "academia_perfis_admin" ON public.academia_perfis FOR ALL TO authenticated USING (public.academia_is_admin()) WITH CHECK (public.academia_is_admin());
-- dados por pessoa: leitura para vinculados, escrita só admin (fluxo normal via funções)
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['academia_user_tracks','academia_user_tasks','academia_milestones','academia_quiz_attempts','academia_user_badges','academia_xp_events'] LOOP
    EXECUTE format('CREATE POLICY "academia_ver" ON public.%I FOR SELECT TO authenticated USING (public.academia_pode_ver(user_id))', t);
    EXECUTE format('CREATE POLICY "academia_admin" ON public.%I FOR ALL TO authenticated USING (public.academia_is_admin()) WITH CHECK (public.academia_is_admin())', t);
  END LOOP;
END $$;
CREATE POLICY "academia_notif_ver" ON public.academia_notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "academia_notif_ler" ON public.academia_notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ===== NÚCLEO =====
CREATE OR REPLACE FUNCTION public.academia_notificar(_uid uuid, _tipo text, _titulo text, _corpo text, _link text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  INSERT INTO public.academia_notifications(user_id,tipo,titulo,corpo,link) VALUES (_uid,_tipo,_titulo,_corpo,_link)
$$;

CREATE OR REPLACE FUNCTION public.academia_nivel_por_xp(_xp int) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN _xp >= 2500 THEN 'Mestre MCF' WHEN _xp >= 1500 THEN 'Consultor Sênior'
    WHEN _xp >= 800 THEN 'Consultor' WHEN _xp >= 300 THEN 'Operador' ELSE 'Trainee' END
$$;

CREATE OR REPLACE FUNCTION public.academia_tg_xp() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v int; BEGIN
  SELECT coalesce(sum(xp),0) INTO v FROM public.academia_xp_events WHERE user_id=NEW.user_id;
  UPDATE public.academia_perfis SET xp_total=v, nivel=public.academia_nivel_por_xp(v), updated_at=now() WHERE id=NEW.user_id;
  RETURN NEW; END $$;
CREATE TRIGGER academia_xp_aiu AFTER INSERT ON public.academia_xp_events FOR EACH ROW EXECUTE FUNCTION public.academia_tg_xp();

-- fase liberada? (só a trilha principal tem a trava da Fase 0)
CREATE OR REPLACE FUNCTION public.academia_fase_liberada(_user_track_id uuid, _phase_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CASE
    WHEN (SELECT codigo FROM academia_phases WHERE id=_phase_id) = 'fase_0' THEN true
    WHEN (SELECT tipo FROM academia_user_tracks WHERE id=_user_track_id) = 'extensao' THEN true
    ELSE NOT EXISTS (
      SELECT 1 FROM academia_user_tasks ut JOIN academia_tasks t ON t.id=ut.task_id
      JOIN academia_modules m ON m.id=t.module_id JOIN academia_phases p ON p.id=m.phase_id
      WHERE ut.user_track_id=_user_track_id AND p.codigo='fase_0' AND t.obrigatoria AND ut.status<>'aprovada')
  END
$$;

CREATE OR REPLACE FUNCTION public.academia_fase_concluida(_user_track_id uuid, _codigo text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM academia_user_tasks ut JOIN academia_tasks t ON t.id=ut.task_id
      JOIN academia_modules m ON m.id=t.module_id JOIN academia_phases p ON p.id=m.phase_id
      WHERE ut.user_track_id=_user_track_id AND p.codigo=_codigo)
  AND NOT EXISTS (SELECT 1 FROM academia_user_tasks ut JOIN academia_tasks t ON t.id=ut.task_id
      JOIN academia_modules m ON m.id=t.module_id JOIN academia_phases p ON p.id=m.phase_id
      WHERE ut.user_track_id=_user_track_id AND p.codigo=_codigo AND t.obrigatoria AND ut.status<>'aprovada')
$$;

-- ===== BADGES =====
CREATE OR REPLACE FUNCTION public.academia_produto_nivel_ok(_uid uuid, _produto uuid, _nivel int) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM academia_tasks t WHERE t.produto_id=_produto AND t.badge_nivel=_nivel)
  AND NOT EXISTS (
    SELECT 1 FROM academia_tasks t WHERE t.produto_id=_produto AND t.badge_nivel=_nivel
      AND NOT EXISTS (SELECT 1 FROM academia_user_tasks ut WHERE ut.user_id=_uid AND ut.task_id=t.id AND ut.status='aprovada'))
  AND (_nivel <> 1 OR EXISTS (SELECT 1 FROM academia_quiz_attempts a JOIN academia_quizzes q ON q.id=a.quiz_id
        WHERE a.user_id=_uid AND a.aprovado AND q.produto_id=_produto AND q.nivel=1))
$$;

CREATE OR REPLACE FUNCTION public.academia_check_badges(_uid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b record; r jsonb; ok boolean; v_track uuid; n int;
BEGIN
  SELECT id INTO v_track FROM academia_user_tracks WHERE user_id=_uid AND tipo='principal';
  FOR b IN SELECT bd.*, br.regra FROM academia_badges bd JOIN academia_badge_rules br ON br.badge_id=bd.id
           WHERE NOT EXISTS (SELECT 1 FROM academia_user_badges ub WHERE ub.user_id=_uid AND ub.badge_id=bd.id)
           ORDER BY bd.tipo='mestre', bd.nivel NULLS FIRST LOOP
    r := b.regra; ok := false;
    IF r->>'tipo' = 'fase_concluida' THEN
      ok := v_track IS NOT NULL AND academia_fase_concluida(v_track, r->>'fase');
    ELSIF r->>'tipo' = 'tarefas_aprovadas' THEN
      SELECT count(*) = jsonb_array_length(r->'slugs') INTO ok FROM (
        SELECT DISTINCT t.slug FROM academia_user_tasks ut JOIN academia_tasks t ON t.id=ut.task_id
        WHERE ut.user_id=_uid AND ut.status='aprovada' AND t.slug IN (SELECT jsonb_array_elements_text(r->'slugs'))) s;
    ELSIF r->>'tipo' = 'marco_fechado' THEN
      ok := EXISTS (SELECT 1 FROM academia_milestones WHERE user_id=_uid AND codigo=r->>'codigo' AND fechado_em IS NOT NULL);
    ELSIF r->>'tipo' = 'produto_nivel' THEN
      ok := true;
      FOR n IN 1..coalesce(b.nivel,1) LOOP
        IF NOT academia_produto_nivel_ok(_uid, b.produto_id, n) THEN ok := false; END IF;
      END LOOP;
    ELSIF r->>'tipo' = 'mestre_ecossistema' THEN
      SELECT count(DISTINCT bd.produto_id) >= (SELECT count(*) FROM academia_produtos) INTO ok
        FROM academia_user_badges ub JOIN academia_badges bd ON bd.id=ub.badge_id
        WHERE ub.user_id=_uid AND bd.tipo='produto' AND bd.nivel>=3;
      ok := ok AND EXISTS (SELECT 1 FROM academia_user_badges ub JOIN academia_badges bd ON bd.id=ub.badge_id
        WHERE ub.user_id=_uid AND bd.slug='visao-cruzada');
    END IF;
    IF ok THEN
      INSERT INTO academia_user_badges(user_id,badge_id,evidencia) VALUES (_uid,b.id,r) ON CONFLICT DO NOTHING;
      IF b.xp_bonus > 0 THEN
        INSERT INTO academia_xp_events(user_id,origem,referencia_id,xp) VALUES (_uid,'badge',b.id,b.xp_bonus) ON CONFLICT DO NOTHING;
      END IF;
      PERFORM academia_notificar(_uid,'badge','Badge conquistado: '||b.nome, b.descricao, '/academia/estante');
    END IF;
  END LOOP;
END $$;

-- ===== TRIGGERS DE PROGRESSO =====
CREATE OR REPLACE FUNCTION public.academia_tg_user_task() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_xp int; v_tipo text; v_perfil record; m record;
BEGIN
  IF NEW.status='aprovada' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'aprovada') THEN
    SELECT xp INTO v_xp FROM academia_tasks WHERE id=NEW.task_id;
    INSERT INTO academia_xp_events(user_id,origem,referencia_id,xp) VALUES (NEW.user_id,'task',NEW.id,coalesce(v_xp,0)) ON CONFLICT DO NOTHING;
    SELECT tipo INTO v_tipo FROM academia_user_tracks WHERE id=NEW.user_track_id;
    SELECT * INTO v_perfil FROM academia_perfis WHERE id=NEW.user_id;
    IF v_tipo='principal' THEN
      IF academia_fase_concluida(NEW.user_track_id,'fase_0') AND academia_fase_concluida(NEW.user_track_id,'fase_1') THEN
        INSERT INTO academia_milestones(user_track_id,user_id,codigo) VALUES (NEW.user_track_id,NEW.user_id,'marco_30')
          ON CONFLICT DO NOTHING RETURNING * INTO m;
        IF m.id IS NOT NULL THEN
          PERFORM academia_notificar(v_perfil.gestor_id,'marco','Marco de 30 dias para assinar', v_perfil.nome, '/academia/validacoes');
          PERFORM academia_notificar(v_perfil.padrinho_id,'marco','Marco de 30 dias para assinar', v_perfil.nome, '/academia/validacoes');
        END IF;
        m := NULL;
      END IF;
      IF academia_fase_concluida(NEW.user_track_id,'fase_0') AND academia_fase_concluida(NEW.user_track_id,'fase_1')
         AND academia_fase_concluida(NEW.user_track_id,'fase_2') AND academia_fase_concluida(NEW.user_track_id,'fase_3') THEN
        INSERT INTO academia_milestones(user_track_id,user_id,codigo) VALUES (NEW.user_track_id,NEW.user_id,'conclusao_90') ON CONFLICT DO NOTHING;
      END IF;
    ELSE
      IF academia_fase_concluida(NEW.user_track_id,'fase_1') THEN
        UPDATE academia_user_tracks SET status='concluida', concluida_em=coalesce(concluida_em,now()) WHERE id=NEW.user_track_id;
      END IF;
    END IF;
  END IF;
  PERFORM academia_check_badges(NEW.user_id);
  RETURN NEW;
END $$;
CREATE TRIGGER academia_user_tasks_aiu AFTER INSERT OR UPDATE ON public.academia_user_tasks FOR EACH ROW EXECUTE FUNCTION public.academia_tg_user_task();

CREATE OR REPLACE FUNCTION public.academia_tg_quiz_attempt() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.aprovado THEN
    UPDATE academia_user_tasks ut SET status='aprovada', marcada_em=now(), validada_em=now()
      FROM academia_tasks t WHERE t.id=ut.task_id AND t.quiz_id=NEW.quiz_id AND ut.user_id=NEW.user_id AND ut.status<>'aprovada'
      AND academia_fase_liberada(ut.user_track_id,(SELECT phase_id FROM academia_modules WHERE id=t.module_id));
    INSERT INTO academia_xp_events(user_id,origem,referencia_id,xp) VALUES (NEW.user_id,'quiz',NEW.quiz_id,20) ON CONFLICT DO NOTHING;
  END IF;
  PERFORM academia_check_badges(NEW.user_id);
  RETURN NEW; END $$;
CREATE TRIGGER academia_quiz_attempts_ai AFTER INSERT ON public.academia_quiz_attempts FOR EACH ROW EXECUTE FUNCTION public.academia_tg_quiz_attempt();

CREATE OR REPLACE FUNCTION public.academia_tg_milestone() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.fechado_em IS NOT NULL AND (TG_OP='INSERT' OR OLD.fechado_em IS NULL) THEN
    INSERT INTO academia_xp_events(user_id,origem,referencia_id,xp) VALUES (NEW.user_id,'marco',NEW.id,100) ON CONFLICT DO NOTHING;
    IF NEW.codigo='conclusao_90' THEN
      UPDATE academia_user_tracks SET status='concluida', concluida_em=now() WHERE id=NEW.user_track_id;
      UPDATE academia_perfis SET status='concluido', updated_at=now() WHERE id=NEW.user_id;
    END IF;
    PERFORM academia_notificar(NEW.user_id,'marco','Marco assinado', CASE WHEN NEW.codigo='marco_30' THEN 'Rampa de 30 dias fechada.' ELSE '90 dias concluídos.' END, '/academia');
  END IF;
  PERFORM academia_check_badges(NEW.user_id);
  RETURN NEW; END $$;
CREATE TRIGGER academia_milestones_aiu AFTER INSERT OR UPDATE ON public.academia_milestones FOR EACH ROW EXECUTE FUNCTION public.academia_tg_milestone();

-- ===== RPCs =====
CREATE OR REPLACE FUNCTION public.academia_gerar_trilha() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid := auth.uid(); p record; v_global uuid; v_track uuid;
BEGIN
  SELECT * INTO p FROM academia_perfis WHERE id=v_uid;
  IF p.id IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO v_track FROM academia_user_tracks WHERE user_id=v_uid AND tipo='principal';
  IF v_track IS NOT NULL THEN RETURN v_track; END IF;
  SELECT id INTO v_global FROM academia_track_templates WHERE frente_id IS NULL AND publicado ORDER BY versao DESC LIMIT 1;
  IF v_global IS NULL THEN RAISE EXCEPTION 'sem_template: nenhum template global publicado'; END IF;
  INSERT INTO academia_user_tracks(user_id,track_template_id,tipo,frente_id) VALUES (v_uid,v_global,'principal',p.frente_id) RETURNING id INTO v_track;
  INSERT INTO academia_user_tasks(user_track_id,user_id,task_id)
  SELECT v_track, v_uid, t.id FROM academia_tasks t JOIN academia_modules m ON m.id=t.module_id JOIN academia_phases ph ON ph.id=m.phase_id
   WHERE ph.track_template_id = v_global
      OR (ph.codigo='fase_1' AND ph.track_template_id = (SELECT id FROM academia_track_templates WHERE frente_id=p.frente_id AND publicado ORDER BY versao DESC LIMIT 1))
  ON CONFLICT DO NOTHING;
  UPDATE academia_perfis SET status='em_trilha', updated_at=now() WHERE id=v_uid AND status='ativo';
  RETURN v_track;
END $$;

CREATE OR REPLACE FUNCTION public.academia_abrir_extensao(_frente_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid := auth.uid(); v_tpl uuid; v_track uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM academia_milestones WHERE user_id=v_uid AND codigo='conclusao_90' AND fechado_em IS NOT NULL) THEN
    RAISE EXCEPTION 'bloqueado: extensões liberam após a conclusão dos 90 dias'; END IF;
  SELECT id INTO v_tpl FROM academia_track_templates WHERE frente_id=_frente_id AND publicado ORDER BY versao DESC LIMIT 1;
  IF v_tpl IS NULL THEN RAISE EXCEPTION 'sem_template: frente sem trilha publicada'; END IF;
  INSERT INTO academia_user_tracks(user_id,track_template_id,tipo,frente_id) VALUES (v_uid,v_tpl,'extensao',_frente_id)
    ON CONFLICT DO NOTHING RETURNING id INTO v_track;
  IF v_track IS NULL THEN SELECT id INTO v_track FROM academia_user_tracks WHERE user_id=v_uid AND tipo='extensao' AND frente_id=_frente_id; END IF;
  INSERT INTO academia_user_tasks(user_track_id,user_id,task_id)
  SELECT v_track, v_uid, t.id FROM academia_tasks t JOIN academia_modules m ON m.id=t.module_id JOIN academia_phases ph ON ph.id=m.phase_id
   WHERE ph.track_template_id=v_tpl
     AND NOT EXISTS (SELECT 1 FROM academia_user_tasks x WHERE x.user_id=v_uid AND x.task_id=t.id)
  ON CONFLICT DO NOTHING;
  RETURN v_track;
END $$;

CREATE OR REPLACE FUNCTION public.academia_enviar_tarefa(_user_task_id uuid, _evidencia_url text DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ut record; t record; v_phase uuid; v_novo text; p record;
BEGIN
  SELECT * INTO ut FROM academia_user_tasks WHERE id=_user_task_id;
  IF ut.id IS NULL OR ut.user_id<>auth.uid() THEN RAISE EXCEPTION 'sem_permissao: tarefa não pertence a você'; END IF;
  IF ut.status IN ('aprovada','enviada') THEN RAISE EXCEPTION 'estado_invalido: tarefa já enviada ou aprovada'; END IF;
  SELECT * INTO t FROM academia_tasks WHERE id=ut.task_id;
  SELECT phase_id INTO v_phase FROM academia_modules WHERE id=t.module_id;
  IF NOT academia_fase_liberada(ut.user_track_id, v_phase) THEN RAISE EXCEPTION 'fase_bloqueada: conclua a Fase 0 primeiro'; END IF;
  IF t.tipo_validacao='quiz' THEN RAISE EXCEPTION 'quiz: esta tarefa é concluída pelo quiz'; END IF;
  IF t.tipo_validacao IN ('evidencia','pratica') AND coalesce(_evidencia_url,'')='' THEN RAISE EXCEPTION 'evidencia_obrigatoria: anexe a evidência'; END IF;
  v_novo := CASE WHEN t.tipo_validacao IN ('auto','evidencia') THEN 'aprovada' ELSE 'enviada' END;
  UPDATE academia_user_tasks SET status=v_novo, marcada_em=now(), enviada_em=now(),
    evidencia_url=coalesce(_evidencia_url,evidencia_url), validada_em=CASE WHEN v_novo='aprovada' THEN now() END
    WHERE id=_user_task_id;
  IF v_novo='enviada' THEN
    SELECT * INTO p FROM academia_perfis WHERE id=ut.user_id;
    PERFORM academia_notificar(CASE WHEN t.tipo_validacao='padrinho' THEN p.padrinho_id ELSE p.gestor_id END,
      'validacao','Nova tarefa para validar', p.nome||' — '||t.titulo, '/academia/validacoes');
  END IF;
  RETURN v_novo;
END $$;

CREATE OR REPLACE FUNCTION public.academia_desmarcar_tarefa(_user_task_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE academia_user_tasks SET status='pendente', marcada_em=NULL
   WHERE id=_user_task_id AND user_id=auth.uid() AND status='enviada';
END $$;

CREATE OR REPLACE FUNCTION public.academia_validar_tarefa(_user_task_id uuid, _aprovar boolean, _comentario text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ut record; t record; ok boolean;
BEGIN
  SELECT * INTO ut FROM academia_user_tasks WHERE id=_user_task_id;
  SELECT * INTO t FROM academia_tasks WHERE id=ut.task_id;
  IF ut.status<>'enviada' THEN RAISE EXCEPTION 'estado_invalido: tarefa não está aguardando validação'; END IF;
  ok := academia_is_admin() OR (t.tipo_validacao='padrinho' AND academia_is_padrinho_de(ut.user_id))
        OR (t.tipo_validacao IN ('gestor','pratica') AND academia_is_gestor_de(ut.user_id));
  IF NOT ok THEN RAISE EXCEPTION 'sem_permissao: você não valida esta tarefa'; END IF;
  IF NOT _aprovar AND coalesce(trim(_comentario),'')='' THEN RAISE EXCEPTION 'comentario_obrigatorio: explique o motivo da reprovação'; END IF;
  IF _aprovar THEN
    UPDATE academia_user_tasks SET status='aprovada', validada_por=auth.uid(), validada_em=now(), comentario_validador=_comentario WHERE id=_user_task_id;
    PERFORM academia_notificar(ut.user_id,'aprovada','Tarefa aprovada', t.titulo, '/academia');
  ELSE
    UPDATE academia_user_tasks SET status='pendente', validada_por=auth.uid(), validada_em=now(), comentario_validador=_comentario,
      reprovacoes=reprovacoes+1 WHERE id=_user_task_id;
    PERFORM academia_notificar(ut.user_id,'reprovada','Tarefa devolvida para ajuste', t.titulo||': '||_comentario, '/academia');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.academia_quiz_perguntas(_quiz_id uuid) RETURNS TABLE(id uuid, ordem int, enunciado text, alternativas jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT id, ordem, enunciado, alternativas FROM academia_quiz_questions WHERE quiz_id=_quiz_id AND auth.uid() IS NOT NULL ORDER BY ordem
$$;

CREATE OR REPLACE FUNCTION public.academia_quiz_conferir(_question_id uuid, _resposta int) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object('acertou', correta=_resposta, 'correta', correta, 'explicacao', explicacao)
  FROM academia_quiz_questions WHERE id=_question_id AND auth.uid() IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.academia_quiz_finalizar(_quiz_id uuid, _respostas jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q record; v_total int; v_acertos int; v_nota int; v_tent int; v_aprov boolean;
BEGIN
  SELECT * INTO q FROM academia_quizzes WHERE id=_quiz_id;
  IF NOT EXISTS (SELECT 1 FROM academia_perfis WHERE id=auth.uid()) THEN RAISE EXCEPTION 'sem_permissao: sem perfil na Academia'; END IF;
  SELECT count(*) INTO v_tent FROM academia_quiz_attempts WHERE user_id=auth.uid() AND quiz_id=_quiz_id;
  IF v_tent >= q.tentativas_max THEN RAISE EXCEPTION 'tentativas_esgotadas: limite de % tentativas atingido', q.tentativas_max; END IF;
  SELECT count(*), count(*) FILTER (WHERE (_respostas->>qq.id::text)::int = qq.correta) INTO v_total, v_acertos
    FROM academia_quiz_questions qq WHERE qq.quiz_id=_quiz_id;
  v_nota := CASE WHEN v_total=0 THEN 0 ELSE round(v_acertos*100.0/v_total) END;
  v_aprov := v_nota >= q.nota_minima;
  INSERT INTO academia_quiz_attempts(user_id,quiz_id,nota,aprovado,respostas) VALUES (auth.uid(),_quiz_id,v_nota,v_aprov,_respostas);
  RETURN jsonb_build_object('nota',v_nota,'aprovado',v_aprov,'acertos',v_acertos,'total',v_total,'tentativas_restantes',q.tentativas_max-v_tent-1);
END $$;

CREATE OR REPLACE FUNCTION public.academia_assinar_marco(_milestone_id uuid, _papel text, _observacoes text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m record;
BEGIN
  SELECT * INTO m FROM academia_milestones WHERE id=_milestone_id;
  IF m.fechado_em IS NOT NULL THEN RAISE EXCEPTION 'estado_invalido: marco já fechado'; END IF;
  IF _papel='gestor' AND (academia_is_gestor_de(m.user_id) OR academia_is_admin()) THEN
    UPDATE academia_milestones SET assinatura_gestor_em=now(), observacoes=coalesce(_observacoes,observacoes) WHERE id=_milestone_id;
  ELSIF _papel='padrinho' AND (academia_is_padrinho_de(m.user_id) OR academia_is_admin()) THEN
    UPDATE academia_milestones SET assinatura_padrinho_em=now(), observacoes=coalesce(_observacoes,observacoes) WHERE id=_milestone_id;
  ELSIF _papel='colaborador' AND m.user_id=auth.uid() AND m.codigo='conclusao_90' THEN
    UPDATE academia_milestones SET assinatura_colaborador_em=now() WHERE id=_milestone_id;
  ELSE RAISE EXCEPTION 'sem_permissao: você não pode assinar como %', _papel; END IF;
  UPDATE academia_milestones SET fechado_em=now() WHERE id=_milestone_id AND fechado_em IS NULL
    AND assinatura_gestor_em IS NOT NULL AND assinatura_padrinho_em IS NOT NULL
    AND (codigo='marco_30' OR assinatura_colaborador_em IS NOT NULL);
END $$;

CREATE OR REPLACE FUNCTION public.academia_media_turma() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH me AS (SELECT data_inicio FROM academia_perfis WHERE id=auth.uid()),
  turma AS (SELECT p.id FROM academia_perfis p, me WHERE date_trunc('month',p.data_inicio)=date_trunc('month',me.data_inicio)),
  prog AS (SELECT ut.user_id, avg((ut.status='aprovada')::int)*100 pct FROM academia_user_tasks ut
    JOIN academia_user_tracks tr ON tr.id=ut.user_track_id AND tr.tipo='principal' WHERE ut.user_id IN (SELECT id FROM turma) GROUP BY ut.user_id)
  SELECT jsonb_build_object('pessoas',(SELECT count(*) FROM turma),'media',coalesce(round((SELECT avg(pct) FROM prog)),0))
$$;

CREATE OR REPLACE FUNCTION public.academia_buscar_usuarios(_busca text) RETURNS TABLE(id uuid, full_name text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT id, full_name, email FROM public.profiles
  WHERE public.academia_is_admin() AND (full_name ILIKE '%'||_busca||'%' OR email ILIKE '%'||_busca||'%') ORDER BY full_name LIMIT 20
$$;

CREATE OR REPLACE FUNCTION public.academia_nomes(_ids uuid[]) RETURNS TABLE(id uuid, full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT id, full_name FROM public.profiles WHERE id = ANY(_ids) AND auth.uid() IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.academia_relatorios() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT academia_is_admin() THEN RAISE EXCEPTION 'sem_permissao: somente admin/RH'; END IF;
  SELECT jsonb_build_object(
    'tempo_medio_fase', (SELECT coalesce(jsonb_agg(x ORDER BY x->>'codigo'),'[]') FROM (
       SELECT jsonb_build_object('codigo',ph.codigo,'dias',round(avg(EXTRACT(epoch FROM (fim - tr.iniciada_em))/86400)::numeric,1)) x
       FROM (SELECT ut.user_track_id, ph.codigo, max(ut.validada_em) fim FROM academia_user_tasks ut
             JOIN academia_tasks t ON t.id=ut.task_id JOIN academia_modules m ON m.id=t.module_id JOIN academia_phases ph ON ph.id=m.phase_id
             GROUP BY 1,2 HAVING bool_and(ut.status='aprovada' OR NOT t.obrigatoria)) f
       JOIN academia_user_tracks tr ON tr.id=f.user_track_id JOIN (SELECT DISTINCT codigo FROM academia_phases) ph ON ph.codigo=f.codigo
       GROUP BY ph.codigo) s),
    'mais_reprovadas', (SELECT coalesce(jsonb_agg(jsonb_build_object('titulo',titulo,'reprovacoes',n)),'[]') FROM (
       SELECT t.titulo, sum(ut.reprovacoes) n FROM academia_user_tasks ut JOIN academia_tasks t ON t.id=ut.task_id
       GROUP BY t.titulo HAVING sum(ut.reprovacoes)>0 ORDER BY n DESC LIMIT 10) s),
    'teste_3min', (SELECT jsonb_build_object('total',count(*) FILTER (WHERE ut.status='aprovada'),
       'primeira',count(*) FILTER (WHERE ut.status='aprovada' AND ut.reprovacoes=0))
       FROM academia_user_tasks ut JOIN academia_tasks t ON t.id=ut.task_id WHERE t.slug='teste-3-minutos'),
    'pessoas', (SELECT jsonb_build_object('total',count(*),'em_trilha',count(*) FILTER (WHERE status='em_trilha'),'concluido',count(*) FILTER (WHERE status='concluido')) FROM academia_perfis)
  ) INTO r;
  RETURN r;
END $$;
