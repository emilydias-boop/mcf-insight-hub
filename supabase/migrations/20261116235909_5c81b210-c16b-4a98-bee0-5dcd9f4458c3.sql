-- =====================================================================
-- App iPhone "MCF Gestão" — 3 funções NOVAS, somente leitura.
-- Nenhum INSERT/UPDATE/DELETE. Não altera função, policy nem tabela existente.
-- Não chama nenhuma função que grave (academia_gerar_trilha, academia_notificar,
-- academia_check_badges ficam de fora).
--   1) public.academia_app_trilha()             SECURITY INVOKER (RLS da Academia)
--   2) public.academia_app_equipe()             SECURITY DEFINER
--   3) public.posvenda_app_resumo(date, date)   SECURITY DEFINER
-- Erros: sem login = 28000 'nao_autenticado'; sem permissão = 42501 'sem_permissao'.
-- Datas: America/Sao_Paulo.
-- =====================================================================


-- =====================================================================
-- 2) academia_app_equipe()  (vem antes porque a 1 usa no cálculo de ve_equipe)
-- Regras de origem:
--   - src/pages/academia/PainelGestor.tsx (lista da equipe: fase atual, dia X de 90,
--     progresso, atraso, aguardando validação);
--   - src/pages/academia/Validacoes.tsx + academia_validar_tarefa (migration
--     20260924030442): quem valida o quê;
--   - decisão do dono: manager/coordenador SÓ VEEM a equipe pela hierarquia
--     employees.gestor_id (recursiva para baixo), sem validar.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.academia_app_equipe()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET timezone TO 'America/Sao_Paulo'
AS $fn$
DECLARE
  v_uid   uuid := auth.uid();
  v_admin boolean;
  v_lider boolean;
  v_hoje  date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_res   jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'nao_autenticado' USING ERRCODE = '28000';
  END IF;

  -- academia_is_admin(): admin ou rh (migration 20260924030442).
  v_admin := public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'rh');
  -- Liderança só acompanha (não valida): papéis manager e coordenador.
  v_lider := public.has_role(v_uid, 'manager') OR public.has_role(v_uid, 'coordenador');

  WITH RECURSIVE
  -- Ficha(s) RH ATIVA(S) do usuário logado. Um só login por ficha:
  -- coalesce(user_id, profile_id) (user_id é o vínculo canônico da RLS; profile_id é legado).
  -- Ficha desligada (status 'desligado' ou data_demissao) não dá equipe.
  meus_emp AS (
    SELECT e.id
    FROM public.employees e
    WHERE coalesce(e.user_id, e.profile_id) = v_uid
      AND e.status IS DISTINCT FROM 'desligado'
      AND e.data_demissao IS NULL
  ),
  -- Cadeia para cima (chefes do usuário). UNION evita laço em ciclo de gestor_id.
  -- Serve para nunca mostrar um chefe como subordinado quando a cadeia tem ciclo.
  acima (id) AS (
    SELECT e.gestor_id
    FROM public.employees e
    JOIN meus_emp me ON me.id = e.id
    WHERE e.gestor_id IS NOT NULL
    UNION
    SELECT e.gestor_id
    FROM public.employees e
    JOIN acima ac ON e.id = ac.id
    WHERE e.gestor_id IS NOT NULL
  ),
  -- Hierarquia para baixo por employees.gestor_id (FK employees.id). UNION evita laço.
  -- A recursão passa por chefes intermediários desligados (cadeia ainda não atualizada).
  abaixo (id) AS (
    SELECT e.id
    FROM public.employees e
    WHERE v_lider
      AND e.gestor_id IN (SELECT me.id FROM meus_emp me)
      AND e.id NOT IN (SELECT me.id FROM meus_emp me)
      AND e.id NOT IN (SELECT ac.id FROM acima ac)
    UNION
    SELECT e2.id
    FROM public.employees e2
    JOIN abaixo a ON e2.gestor_id = a.id
    WHERE e2.id NOT IN (SELECT me.id FROM meus_emp me)
      AND e2.id NOT IN (SELECT ac.id FROM acima ac)
  ),
  -- Logins dos subordinados ATIVOS (o perfil da Academia usa o id do login).
  sub_users AS (
    SELECT DISTINCT coalesce(e.user_id, e.profile_id) AS uid
    FROM abaixo a
    JOIN public.employees e ON e.id = a.id
    WHERE coalesce(e.user_id, e.profile_id) IS NOT NULL
      AND coalesce(e.user_id, e.profile_id) <> v_uid
      AND e.status IS DISTINCT FROM 'desligado'
      AND e.data_demissao IS NULL
  ),
  -- Quem o usuário pode ver.
  -- Admin/RH e gestor/padrinho: como no site (inclui perfis 'encerrado').
  -- Hierarquia (manager/coordenador): só perfis não encerrados.
  visiveis AS (
    SELECT p.id, p.nome, p.frente_id, p.data_inicio, p.xp_total, p.nivel,
           p.gestor_id, p.padrinho_id,
           (v_admin
            OR p.gestor_id   IS NOT DISTINCT FROM v_uid
            OR p.padrinho_id IS NOT DISTINCT FROM v_uid) AS pode_validar
    FROM public.academia_perfis p
    WHERE (v_admin OR p.id <> v_uid)
      AND (
             v_admin
         OR p.gestor_id = v_uid
         OR p.padrinho_id = v_uid
         OR (p.status <> 'encerrado' AND p.id IN (SELECT su.uid FROM sub_users su))
      )
  ),
  -- Trilha principal de cada pessoa visível (PainelGestor usa só a principal).
  trilha AS (
    SELECT tr.id AS user_track_id, tr.user_id
    FROM public.academia_user_tracks tr
    JOIN visiveis v ON v.id = tr.user_id
    WHERE tr.tipo = 'principal'
  ),
  tarefas AS (
    SELECT tl.user_id, ut.status, t.obrigatoria,
           ph.id AS phase_id, ph.codigo, ph.ordem AS fase_ordem, ph.titulo AS fase_nome, ph.dia_fim
    FROM trilha tl
    JOIN public.academia_user_tasks ut ON ut.user_track_id = tl.user_track_id
    JOIN public.academia_tasks t       ON t.id = ut.task_id
    JOIN public.academia_modules m     ON m.id = t.module_id
    JOIN public.academia_phases ph     ON ph.id = m.phase_id
  ),
  -- agruparPorFase (src/lib/academia.ts) agrupa por phase.id.
  fases AS (
    SELECT tk.user_id, tk.phase_id, tk.codigo, tk.fase_ordem, tk.fase_nome, tk.dia_fim,
           count(*) FILTER (WHERE tk.obrigatoria)                           AS total_obrig,
           count(*) FILTER (WHERE tk.obrigatoria AND tk.status = 'aprovada') AS aprov_obrig
    FROM tarefas tk
    GROUP BY tk.user_id, tk.phase_id, tk.codigo, tk.fase_ordem, tk.fase_nome, tk.dia_fim
  ),
  -- Fase atual = primeira não concluída (concluída = todas as obrigatórias aprovadas).
  atual AS (
    SELECT DISTINCT ON (f.user_id) f.user_id, f.fase_nome, f.dia_fim
    FROM fases f
    WHERE f.aprov_obrig < f.total_obrig
    ORDER BY f.user_id, f.codigo, f.fase_ordem, f.phase_id
  ),
  -- Progresso = obrigatórias aprovadas / obrigatórias (progresso() do site).
  prog AS (
    SELECT tk.user_id,
           count(*) FILTER (WHERE tk.obrigatoria)                           AS obr,
           count(*) FILTER (WHERE tk.obrigatoria AND tk.status = 'aprovada') AS obr_ok
    FROM tarefas tk
    GROUP BY tk.user_id
  ),
  -- Aguardando validação: tarefas 'enviada' da trilha principal (igual ao PainelGestor).
  -- A lista 'validacoes' abaixo inclui todas as trilhas, como a tela Validações.
  aguard AS (
    SELECT tl.user_id, count(*) AS n
    FROM trilha tl
    JOIN public.academia_user_tasks ut ON ut.user_track_id = tl.user_track_id
    WHERE ut.status = 'enviada'
    GROUP BY tl.user_id
  )
  SELECT jsonb_build_object(
    'pessoas', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'user_id',              v.id,
               'nome',                 v.nome,
               'frente',               fr.nome,
               'dia',                  greatest(1, (v_hoje - v.data_inicio) + 1),
               'progresso_pct',        CASE WHEN coalesce(pg.obr, 0) = 0 THEN 0
                                            ELSE round(pg.obr_ok * 100.0 / pg.obr)::int END,
               -- null = ainda não acessou (sem trilha principal); 'Trilha concluída' = tudo aprovado.
               'fase_atual',           CASE WHEN tl.user_track_id IS NULL THEN NULL
                                            WHEN a.user_id IS NULL THEN 'Trilha concluída'
                                            ELSE a.fase_nome END,
               'atrasada',             coalesce(a.dia_fim IS NOT NULL
                                                AND greatest(1, (v_hoje - v.data_inicio) + 1) > a.dia_fim, false),
               'xp',                   v.xp_total,
               'nivel',                v.nivel,
               'aguardando_validacao', coalesce(ag.n, 0)::int,
               'pode_validar',         v.pode_validar
             ) ORDER BY v.nome, v.id)
      FROM visiveis v
      LEFT JOIN public.academia_frentes fr ON fr.id = v.frente_id
      LEFT JOIN trilha tl ON tl.user_id = v.id
      LEFT JOIN prog   pg ON pg.user_id = v.id
      LEFT JOIN atual  a  ON a.user_id  = v.id
      LEFT JOIN aguard ag ON ag.user_id = v.id
    ), '[]'::jsonb),
    -- Fila de Validações.tsx, com a regra do RPC academia_validar_tarefa:
    -- admin/rh todas; padrinho valida tipo 'padrinho'; gestor valida 'gestor' e 'pratica'.
    'validacoes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'user_task_id',   ut.id,
               'pessoa',         pv.nome,
               'tarefa',         t.titulo,
               'tipo_validacao', t.tipo_validacao,
               'evidencia_url',  ut.evidencia_url,
               'enviada_em',     to_char(ut.enviada_em, 'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM')
             ) ORDER BY ut.enviada_em NULLS LAST, ut.id)
      FROM public.academia_user_tasks ut
      -- Direto em academia_perfis (sem a hierarquia e sem filtro de 'encerrado'):
      -- a fila depende só do papel de validador, como Validacoes.tsx.
      JOIN public.academia_perfis pv ON pv.id = ut.user_id
      JOIN public.academia_tasks t   ON t.id = ut.task_id
      WHERE ut.status = 'enviada'
        AND (
              v_admin
            OR (t.tipo_validacao = 'padrinho' AND pv.padrinho_id = v_uid)
           OR (t.tipo_validacao IN ('gestor', 'pratica') AND pv.gestor_id = v_uid)
        )
    ), '[]'::jsonb)
  )
  INTO v_res;

  RETURN v_res;
END
$fn$;

COMMENT ON FUNCTION public.academia_app_equipe() IS
'App iPhone, Academia, somente leitura. Lista da equipe que o usuário pode ver e a fila de validações dele. '
'Admin/RH vê todos os perfis; gestor e padrinho (academia_perfis.gestor_id/padrinho_id) veem os vinculados; '
'manager e coordenador veem quem está abaixo na hierarquia employees.gestor_id (recursiva), só para acompanhar. '
'Hierarquia: ficha ligada ao login por coalesce(user_id, profile_id); fichas desligadas ficam fora; '
'perfis encerrados ficam fora só nessa perna (admin/RH e gestor/padrinho veem como no site). '
'pode_validar e validacoes seguem a regra de academia_validar_tarefa (validacoes de todas as trilhas); '
'aguardando_validacao conta só a trilha principal, como o Painel do gestor. '
'fase_atual null = ainda não acessou. Sem ninguém visível devolve listas vazias.';

REVOKE ALL ON FUNCTION public.academia_app_equipe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.academia_app_equipe() TO authenticated;


-- =====================================================================
-- 1) academia_app_trilha()
-- Regras de origem:
--   - src/pages/academia/MinhaTrilha.tsx (perfil, dia X de 90, progresso, nível, fases,
--     trilhas adicionais, marcos abertos);
--   - src/pages/academia/FaseDetalhe.tsx + src/components/academia/TarefaItem.tsx
--     (tarefas por módulo, variante por perfil.atuacao_funil, aviso "Devolvida");
--   - src/pages/academia/Estante.tsx (badges);
--   - src/lib/academia.ts (agruparPorFase por phase.id, faseConcluida, progresso, NIVEIS);
--   - trava da fase_0 = academia_fase_liberada (migration 20260924030442).
-- SECURITY INVOKER: lê com a RLS da Academia (academia_pode_ver = o próprio usuário).
-- NÃO chama academia_gerar_trilha (grava). Devolve precisa_gerar = true quando há perfil
-- e não há trilha principal; o app chama rpc('academia_gerar_trilha') só nesse caso.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.academia_app_trilha()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_uid        uuid := auth.uid();
  v_hoje       date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_perfil     public.academia_perfis%ROWTYPE;
  v_tem_perfil boolean := false;
  v_principal  uuid;
  v_dia        int := 1;
  v_prox_nome  text;
  v_prox_xp    int;
  v_pct        int := 0;
  v_frente     text;
  v_perfil_js  jsonb := NULL;
  v_fases      jsonb := '[]'::jsonb;
  v_marcos     jsonb := '[]'::jsonb;
  v_badges     jsonb := '[]'::jsonb;
  v_notif      int := 0;
  v_ve_equipe  boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'nao_autenticado' USING ERRCODE = '28000';
  END IF;

  -- useMeuPerfilAcademia: academia_perfis.id = auth.uid().
  SELECT p.* INTO v_perfil
  FROM public.academia_perfis p
  WHERE p.id = v_uid;
  v_tem_perfil := FOUND;

  IF v_tem_perfil THEN
    -- Trilha principal = academia_user_tracks.tipo = 'principal' (índice único por usuário).
    SELECT tr.id INTO v_principal
    FROM public.academia_user_tracks tr
    WHERE tr.user_id = v_uid AND tr.tipo = 'principal'
    LIMIT 1;

    -- diasDesde(data_inicio): max(1, dias + 1). Aqui no fuso de Brasília.
    v_dia := greatest(1, (v_hoje - v_perfil.data_inicio) + 1);

    -- NIVEIS (src/lib/academia.ts): próximo nível = primeiro com xp > xp_total.
    SELECT n.nome, n.xp INTO v_prox_nome, v_prox_xp
    FROM (VALUES ('Trainee', 0, 1), ('Operador', 300, 2), ('Consultor', 800, 3),
                 ('Consultor Sênior', 1500, 4), ('Mestre MCF', 2500, 5)) AS n(nome, xp, ordem)
    WHERE n.xp > v_perfil.xp_total
    ORDER BY n.ordem
    LIMIT 1;

    -- progresso(): obrigatórias aprovadas / obrigatórias da trilha principal, arredondado.
    SELECT CASE WHEN count(*) = 0 THEN 0
                ELSE round(count(*) FILTER (WHERE ut.status = 'aprovada') * 100.0 / count(*))::int END
      INTO v_pct
    FROM public.academia_user_tasks ut
    JOIN public.academia_tasks t ON t.id = ut.task_id
    WHERE ut.user_id = v_uid
      AND ut.user_track_id = v_principal
      AND t.obrigatoria;

    SELECT fr.nome INTO v_frente
    FROM public.academia_frentes fr
    WHERE fr.id = v_perfil.frente_id;

    v_perfil_js := jsonb_build_object(
      'nome',          v_perfil.nome,
      'frente',        v_frente,
      'dia',           v_dia,
      'dias_total',    90,
      'xp',            v_perfil.xp_total,
      'nivel',         v_perfil.nivel,
      'proximo_nivel', v_prox_nome,
      'xp_proximo',    v_prox_xp,
      'progresso_pct', coalesce(v_pct, 0),
      'status',        v_perfil.status
    );

    -- Fases da principal e das extensões (MinhaTrilha + FaseDetalhe).
    WITH
    trilhas AS (
      SELECT tr.id AS user_track_id, tr.tipo, tr.iniciada_em,
             -- MinhaTrilha: rótulo fixo na principal; extensões = template ?? frente ?? 'Trilha adicional'.
             CASE WHEN tr.tipo = 'principal' THEN 'Trilha de Integração PJ'
                  ELSE coalesce(tt.nome, fr.nome, 'Trilha adicional') END AS trilha_nome
      FROM public.academia_user_tracks tr
      LEFT JOIN public.academia_track_templates tt ON tt.id = tr.track_template_id
      LEFT JOIN public.academia_frentes fr         ON fr.id = tr.frente_id
      WHERE tr.user_id = v_uid
    ),
    base AS (
      SELECT trl.user_track_id, trl.tipo AS trilha, trl.trilha_nome, trl.iniciada_em,
             ph.id AS phase_id, ph.codigo, ph.titulo AS fase_nome, ph.ordem AS fase_ordem,
             ph.dia_inicio, ph.dia_fim,
             m.id AS module_id, m.titulo AS modulo, m.ordem AS mod_ordem,
             t.ordem AS task_ordem, t.titulo, t.detalhe, t.variantes, t.tipo_validacao,
             t.obrigatoria, t.xp, t.quiz_id,
             ut.id AS user_task_id, ut.status, ut.evidencia_url, ut.comentario_validador
      FROM trilhas trl
      JOIN public.academia_user_tasks ut ON ut.user_track_id = trl.user_track_id
      JOIN public.academia_tasks t       ON t.id = ut.task_id
      JOIN public.academia_modules m     ON m.id = t.module_id
      JOIN public.academia_phases ph     ON ph.id = m.phase_id
      WHERE ut.user_id = v_uid
    ),
    -- Trava (só trilha principal): fase_0 com obrigatória ainda não aprovada.
    -- Mesma regra do servidor (academia_fase_liberada) e do FaseDetalhe.
    trava AS (
      SELECT EXISTS (
        SELECT 1 FROM base b0
        WHERE b0.trilha = 'principal' AND b0.codigo = 'fase_0'
          AND b0.obrigatoria AND b0.status <> 'aprovada'
      ) AS fase0_aberta
    ),
    -- agruparPorFase: agrupa por phase.id (pode haver duas fase_1: global + frente).
    fases AS (
      SELECT b.user_track_id, b.trilha, b.trilha_nome, b.iniciada_em,
             b.phase_id, b.codigo, b.fase_nome, b.fase_ordem, b.dia_inicio, b.dia_fim,
             count(*) FILTER (WHERE b.obrigatoria)                          AS total_obrig,
             count(*) FILTER (WHERE b.obrigatoria AND b.status = 'aprovada') AS aprovadas_obrig
      FROM base b
      GROUP BY b.user_track_id, b.trilha, b.trilha_nome, b.iniciada_em,
               b.phase_id, b.codigo, b.fase_nome, b.fase_ordem, b.dia_inicio, b.dia_fim
    )
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'phase_id',        fz.phase_id,
             'codigo',          fz.codigo,
             'nome',            fz.fase_nome,
             'dia_ini',         fz.dia_inicio,
             'dia_fim',         fz.dia_fim,
             'travada',         (fz.trilha = 'principal' AND fz.codigo <> 'fase_0'
                                 AND (SELECT tv.fase0_aberta FROM trava tv)),
             -- faseConcluida: todas as obrigatórias aprovadas.
             'concluida',       fz.aprovadas_obrig = fz.total_obrig,
             -- MinhaTrilha: não concluída, dia > dia_fim e NÃO travada (atrasada && !travada).
             'atrasada',        (fz.trilha = 'principal' AND fz.aprovadas_obrig < fz.total_obrig
                                 AND fz.dia_fim IS NOT NULL AND v_dia > fz.dia_fim
                                 AND NOT (fz.codigo <> 'fase_0' AND (SELECT tv.fase0_aberta FROM trava tv))),
             'total_obrig',     fz.total_obrig,
             'aprovadas_obrig', fz.aprovadas_obrig,
             'trilha',          fz.trilha,
             'trilha_nome',     fz.trilha_nome,
             'tarefas', (
               SELECT coalesce(jsonb_agg(jsonb_build_object(
                        'user_task_id',   b2.user_task_id,
                        'modulo',         b2.modulo,
                        'titulo',         b2.titulo,
                        -- TarefaItem: detalhe + variante de perfil.atuacao_funil
                        -- (sem atuação ou sem chave: todas as variantes).
                        'texto', nullif(concat_ws(E'\n\n',
                                   nullif(btrim(b2.detalhe), ''),
                                   CASE
                                     WHEN b2.variantes IS NULL OR jsonb_typeof(b2.variantes) <> 'object' THEN NULL
                                     WHEN v_perfil.atuacao_funil IS NOT NULL
                                          AND nullif(b2.variantes ->> v_perfil.atuacao_funil, '') IS NOT NULL
                                       THEN b2.variantes ->> v_perfil.atuacao_funil
                                     ELSE (SELECT string_agg(vv.value, E'\n\n')
                                           FROM jsonb_each_text(b2.variantes) AS vv
                                           WHERE nullif(vv.value, '') IS NOT NULL)
                                   END), ''),
                        'tipo_validacao', b2.tipo_validacao,
                        'obrigatoria',    b2.obrigatoria,
                        'status',         b2.status,
                        'xp',             b2.xp,
                        'quiz_id',        b2.quiz_id,
                        'evidencia_url',  b2.evidencia_url,
                        -- Devolvida = status 'pendente' com comentario_validador.
                        'comentario',     CASE WHEN b2.status = 'pendente' THEN nullif(b2.comentario_validador, '') END
                      ) ORDER BY b2.mod_ordem, b2.module_id, b2.task_ordem, b2.user_task_id), '[]'::jsonb)
               FROM base b2
               WHERE b2.user_track_id = fz.user_track_id
                 AND b2.phase_id = fz.phase_id
             )
           ) ORDER BY (fz.trilha <> 'principal'), fz.iniciada_em, fz.user_track_id,
                      fz.codigo, fz.fase_ordem, fz.phase_id), '[]'::jsonb)
      INTO v_fases
    FROM fases fz;

    -- Marcos (MarcoCard): o colaborador só assina o conclusao_90.
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'milestone_id',             ms.id,
             'tipo',                     ms.codigo,
             'status',                   CASE WHEN ms.fechado_em IS NOT NULL THEN 'fechado' ELSE 'aberto' END,
             'precisa_minha_assinatura', (ms.codigo = 'conclusao_90'
                                          AND ms.fechado_em IS NULL
                                          AND ms.assinatura_colaborador_em IS NULL)
           ) ORDER BY ms.created_at, ms.id), '[]'::jsonb)
      INTO v_marcos
    FROM public.academia_milestones ms
    WHERE ms.user_id = v_uid;
  END IF;

  -- Estante: catálogo de badges (ordem) + conquistados do usuário.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'codigo',      bd.slug,
           'nome',        bd.nome,
           'descricao',   bd.descricao,
           'conquistado', EXISTS (SELECT 1 FROM public.academia_user_badges ub
                                  WHERE ub.user_id = v_uid AND ub.badge_id = bd.id)
          ) ORDER BY bd.ordem, bd.nome), '[]'::jsonb)
    INTO v_badges
  FROM public.academia_badges bd;

  -- Sino (AcademiaLayout): não lidas do próprio usuário.
  SELECT count(*)::int INTO v_notif
  FROM public.academia_notifications nt
  WHERE nt.user_id = v_uid AND NOT nt.lida;

  -- ve_equipe: admin/rh, gestor/padrinho de alguém (como o menu do site: vinculados.length > 0),
  -- ou manager/coordenador com alguém abaixo na hierarquia (via academia_app_equipe).
  v_ve_equipe := coalesce(public.academia_is_admin(), false)
    OR EXISTS (SELECT 1 FROM public.academia_perfis px
               WHERE px.id <> v_uid
                 AND (px.gestor_id = v_uid OR px.padrinho_id = v_uid));
  IF NOT v_ve_equipe
     AND (public.has_role(v_uid, 'manager') OR public.has_role(v_uid, 'coordenador')) THEN
    v_ve_equipe := coalesce(jsonb_array_length(public.academia_app_equipe() -> 'pessoas'), 0) > 0;
  END IF;

  RETURN jsonb_build_object(
    'perfil',                 v_perfil_js,
    'precisa_gerar',          (v_tem_perfil AND v_principal IS NULL),
    'fases',                  v_fases,
    'marcos',                 v_marcos,
    'badges',                 v_badges,
    'notificacoes_nao_lidas', v_notif,
    've_equipe',              v_ve_equipe
  );
END
$fn$;

COMMENT ON FUNCTION public.academia_app_trilha() IS
'App iPhone, Academia, somente leitura (SECURITY INVOKER, respeita a RLS). Minha Trilha + Detalhe da fase + Estante '
'do próprio usuário: perfil, fases agrupadas por phase.id com tarefas, trava da fase_0, atraso, marcos, badges, '
'notificações não lidas e se ele vê alguma equipe. Não gera trilha: precisa_gerar = true indica que o app deve '
'chamar academia_gerar_trilha uma vez.';

REVOKE ALL ON FUNCTION public.academia_app_trilha() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.academia_app_trilha() TO authenticated;

-- =====================================================================
-- 3) posvenda_app_resumo(p_ini, p_fim)
-- Regras de origem:
--   - src/pages/pos-venda/AgendaPosVenda.tsx (agenda: pos_venda_reunioes por início);
--   - src/components/crm/pos-venda/PainelComercialPosVendaSection.tsx (régua do painel:
--     Viabilidade 1 com início no período, sem canceladas; realizada; no-show; sem desfecho;
--     período em data civil de Brasília com fim exclusivo);
--   - src/hooks/usePosVendaOverview.ts (entraram em Novos, reagendamentos, concluídas
--     pela crm_cliente_timeline);
--   - migration 20261008210547 (etapa Novos licenciados, crm_cliente_timeline).
-- Escopo: gerente_relacionamento vê só o que é dele (agenda = gerente_id; cartões =
-- owner_profile_id; concluídas = dono do cartão). Liderança (admin, manager, coordenador)
-- vê tudo + por_gerente. Nunca devolve CPF, telefone, e-mail do cliente, observação
-- nem transcrição.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.posvenda_app_resumo(p_ini date, p_fim date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET timezone TO 'America/Sao_Paulo'
AS $fn$
DECLARE
  v_uid    uuid := auth.uid();
  v_lider  boolean;
  v_ger    boolean;
  v_ini    timestamptz;
  v_fim    timestamptz;
  v_agora  timestamptz := now();
  v_hoje   date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  c_origin constant uuid := 'b05a0000-0000-4000-8000-000000000002'; -- pipeline Pós-venda
  c_novos  constant uuid := 'b05a0001-0000-4000-8000-000000000000'; -- Novos licenciados
  c_concl  constant uuid := 'b05a0001-0000-4000-8000-000000000003'; -- Viabilidade Concluída
  v_res    jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'nao_autenticado' USING ERRCODE = '28000';
  END IF;

  v_lider := public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'manager')
          OR public.has_role(v_uid, 'coordenador');
  v_ger   := public.has_role(v_uid, 'gerente_relacionamento');
  IF NOT (v_lider OR v_ger) THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;

  IF p_ini IS NULL OR p_fim IS NULL OR p_fim < p_ini OR (p_fim - p_ini) > 92 THEN
    RAISE EXCEPTION 'periodo_invalido' USING ERRCODE = '22023',
      HINT = 'p_ini <= p_fim, no máximo 93 dias';
  END IF;

  -- Data civil de Brasília, p_fim inclusivo (fim exclusivo = p_fim + 1 às 00:00).
  v_ini := (p_ini::timestamp AT TIME ZONE 'America/Sao_Paulo');
  v_fim := ((p_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo');

  WITH
  -- Reuniões com início no período, no escopo (gerente: só as dele).
  reun AS (
    SELECT r.id, r.deal_id, r.gerente_id, r.tipo, r.inicio, r.status, r.observacao
    FROM public.pos_venda_reunioes r
    WHERE r.inicio >= v_ini AND r.inicio < v_fim
      AND (v_lider OR r.gerente_id = v_uid)
  ),
  -- Cartões ativos da pipeline Pós-venda, no escopo (gerente: dono do cartão).
  deals_pv AS (
    SELECT d.id, d.name, d.owner_profile_id, d.stage_id, d.created_at, d.custom_fields, d.product_name
    FROM public.crm_deals d
    WHERE d.origin_id = c_origin
      AND NOT coalesce(d.is_archived, false)
      AND (v_lider OR d.owner_profile_id = v_uid)
  ),
  -- Cartões hoje em Novos licenciados.
  novos_atual AS (
    SELECT dp.id, dp.name, dp.owner_profile_id, dp.custom_fields, dp.product_name,
           coalesce((SELECT max(tl.created_at)
                     FROM public.crm_cliente_timeline tl
                     WHERE tl.deal_id = dp.id AND tl.stage_para = c_novos),
                     dp.created_at) AS entrou_em,
           EXISTS (SELECT 1 FROM public.pos_venda_reunioes r2
                   WHERE r2.deal_id = dp.id AND r2.status <> 'cancelada') AS tem_reuniao
    FROM deals_pv dp
    WHERE dp.stage_id = c_novos
  ),
  -- usePosVendaOverview "entraram": timeline para Novos no período,
  -- ou cartão criado em Novos no período.
  entraram AS (
    SELECT dp.id, dp.owner_profile_id
    FROM deals_pv dp
    WHERE (dp.stage_id = c_novos AND dp.created_at >= v_ini AND dp.created_at < v_fim)
       OR EXISTS (SELECT 1 FROM public.crm_cliente_timeline tl
                  WHERE tl.deal_id = dp.id AND tl.stage_para = c_novos
                    AND tl.created_at >= v_ini AND tl.created_at < v_fim)
  ),
  -- Concluídas: cartão entrou em Viabilidade Concluída no período (timeline),
  -- creditado ao DONO do cartão (o site credita a quem moveu).
  concl AS (
    SELECT dp.id, dp.owner_profile_id
    FROM deals_pv dp
    WHERE EXISTS (SELECT 1 FROM public.crm_cliente_timeline tl
                  WHERE tl.deal_id = dp.id AND tl.stage_para = c_concl
                    AND tl.created_at >= v_ini AND tl.created_at < v_fim)
  ),
  -- Reagendamento (regra do overview): cancelada no período com outra reunião
  -- não cancelada do mesmo cartão com início posterior.
  reag AS (
    SELECT rc.id, rc.gerente_id
    FROM reun rc
    WHERE rc.status = 'cancelada'
      AND EXISTS (SELECT 1 FROM public.pos_venda_reunioes o
                  WHERE o.deal_id = rc.deal_id AND o.id <> rc.id
                    AND o.status <> 'cancelada' AND o.inicio > rc.inicio)
  ),
  -- Um evento por linha: (indicador, gerente). Base dos KPIs e do por_gerente.
  ev AS (
    SELECT 'novos_licenciados'::text AS chave, en.owner_profile_id AS gid FROM entraram en
    UNION ALL
    SELECT 'sem_reuniao', na.owner_profile_id FROM novos_atual na WHERE NOT na.tem_reuniao
    UNION ALL
    SELECT 'v1_agendadas', ra.gerente_id FROM reun ra
     WHERE ra.tipo = 'viabilidade_1' AND ra.status <> 'cancelada'
    UNION ALL
    SELECT 'realizadas', ra.gerente_id FROM reun ra
     WHERE ra.tipo = 'viabilidade_1' AND ra.status = 'realizada'
    UNION ALL
    SELECT 'no_show', ra.gerente_id FROM reun ra
     WHERE ra.tipo = 'viabilidade_1' AND ra.status = 'no_show'
    UNION ALL
    -- Régua do painel: só V1. Fecha: v1_agendadas = realizadas + no_show + sem_desfecho + agendadas_futuras.
    SELECT 'sem_desfecho', ra.gerente_id FROM reun ra
     WHERE ra.tipo = 'viabilidade_1' AND ra.status = 'agendada' AND ra.inicio < v_agora
    UNION ALL
    SELECT 'agendadas_futuras', ra.gerente_id FROM reun ra
     WHERE ra.tipo = 'viabilidade_1' AND ra.status = 'agendada' AND ra.inicio >= v_agora
    UNION ALL
    SELECT 'v2_agendadas', ra.gerente_id FROM reun ra
     WHERE ra.tipo = 'viabilidade_2' AND ra.status <> 'cancelada'
    UNION ALL
    SELECT 'v2_realizadas', ra.gerente_id FROM reun ra
     WHERE ra.tipo = 'viabilidade_2' AND ra.status = 'realizada'
    UNION ALL
    SELECT 'v2_sem_desfecho', ra.gerente_id FROM reun ra
     WHERE ra.tipo = 'viabilidade_2' AND ra.status = 'agendada' AND ra.inicio < v_agora
    UNION ALL
    SELECT 'reagendamentos', rg.gerente_id FROM reag rg
    UNION ALL
    -- Botão Reagendar (desde 09/11) só muda o início e escreve "Reagendada de ..." na observação.
    SELECT 'reagendadas_no_lugar', ra.gerente_id FROM reun ra
     WHERE ra.status <> 'cancelada' AND coalesce(ra.observacao, '') ILIKE '%Reagendada de %'
    UNION ALL
    SELECT 'viabilidades_concluidas', cc.owner_profile_id FROM concl cc
  ),
  def AS (
    SELECT dd.ordem, dd.chave, dd.rotulo
    FROM (VALUES
      ( 1, 'novos_licenciados',       'Novos licenciados no período'),
      ( 2, 'sem_reuniao',             'Novos licenciados sem reunião (hoje)'),
      ( 3, 'v1_agendadas',            'Viabilidade 1 agendadas'),
      ( 4, 'realizadas',              'Viabilidade 1 realizadas'),
      ( 5, 'no_show',                 'No-show Viabilidade 1'),
      ( 6, 'sem_desfecho',            'Viabilidade 1 sem desfecho'),
      ( 7, 'agendadas_futuras',       'Viabilidade 1 ainda vão acontecer'),
      ( 8, 'v2_agendadas',            'Viabilidade 2 agendadas'),
      ( 9, 'v2_realizadas',           'Viabilidade 2 realizadas'),
      (10, 'v2_sem_desfecho',         'Viabilidade 2 sem desfecho'),
      (11, 'reagendamentos',          'Reagendamentos (cancelada e remarcada)'),
      (12, 'reagendadas_no_lugar',    'Reagendadas no lugar'),
      (13, 'viabilidades_concluidas', 'Viabilidades concluídas')
    ) AS dd(ordem, chave, rotulo)
  ),
  tot AS (
    SELECT df.ordem, df.chave, df.rotulo,
           (SELECT count(*) FROM ev e1 WHERE e1.chave = df.chave)::int AS valor
    FROM def df
  ),
  -- Linhas do por_gerente: gerentes de relacionamento ativos (sempre aparecem)
  -- + qualquer outro dono/gerente que tenha número no período (ex.: admin dono de cartão).
  ger_ids AS (
    SELECT ur.user_id AS gid
    FROM public.user_roles ur
    JOIN public.profiles pf ON pf.id = ur.user_id
    WHERE v_lider
      AND ur.role = 'gerente_relacionamento'
      AND coalesce(pf.access_status, 'ativo') = 'ativo'
    UNION
    SELECT e2.gid FROM ev e2 WHERE v_lider
  ),
  linhas AS (
    SELECT gi.gid,
           CASE WHEN gi.gid IS NULL THEN 'Sem gerente'
                ELSE coalesce(nullif(btrim(pf.full_name), ''), 'Sem nome') END AS nome,
           (SELECT jsonb_agg((SELECT count(*) FROM ev e3
                              WHERE e3.chave = df.chave AND e3.gid IS NOT DISTINCT FROM gi.gid)::int
                             ORDER BY df.ordem)
            FROM def df) AS valores
    FROM ger_ids gi
    LEFT JOIN public.profiles pf ON pf.id = gi.gid
  )
  SELECT jsonb_build_object(
    'lider',   v_lider,
    'periodo', jsonb_build_object('ini', p_ini, 'fim', p_fim),

    'kpis', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'chave', tt.chave, 'rotulo', tt.rotulo, 'formato', 'int', 'valor', tt.valor
             ) ORDER BY tt.ordem), '[]'::jsonb)
      FROM tot tt
    ),

    -- Agenda do período (todas as situações), ordenada por início.
    'agenda', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'reuniao_id', ra.id,
               'inicio',     to_char(ra.inicio, 'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM'),
               -- Nome do cartão pode ser o e-mail (pos_venda_registrar_cliente) ou telefone/CPF
               -- digitado: nesses casos não sai da função.
               'cliente',    CASE WHEN d.name IS NULL OR btrim(d.name) = '' OR d.name ~ '@'
                                       OR d.name ~ '^[+()0-9 ./-]{8,}$'
                                   THEN 'Cliente sem nome' ELSE btrim(d.name) END,
               'tipo',       ra.tipo,
               'status',     ra.status,
               'gerente',    coalesce(nullif(btrim(pf.full_name), ''), 'Sem nome')
             ) ORDER BY ra.inicio, ra.id)
      FROM reun ra
      LEFT JOIN public.crm_deals d ON d.id = ra.deal_id
      LEFT JOIN public.profiles pf ON pf.id = ra.gerente_id
    ), '[]'::jsonb),

    -- Cartões hoje em Novos licenciados, mais recentes primeiro, até 100.
    'novos_licenciados', coalesce((
      SELECT jsonb_agg(x.obj ORDER BY x.entrou_em DESC, x.id)
      FROM (
        SELECT na.id, na.entrou_em,
               jsonb_build_object(
                 'deal_id',            na.id,
                 'cliente',            CASE WHEN na.name IS NULL OR btrim(na.name) = '' OR na.name ~ '@'
                                                 OR na.name ~ '^[+()0-9 ./-]{8,}$'
                                            THEN 'Cliente sem nome' ELSE btrim(na.name) END,
                 'produto',            coalesce(na.custom_fields -> 'pos_venda_compras' -> -1 ->> 'produto',
                                                na.product_name),
                 'entrou_em',          to_char(na.entrou_em, 'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM'),
                 'gerente',            CASE WHEN na.owner_profile_id IS NULL THEN 'Sem gerente'
                                            ELSE coalesce(nullif(btrim(pf.full_name), ''), 'Sem nome') END,
                 'dias_desde_entrada', (v_hoje - (na.entrou_em AT TIME ZONE 'America/Sao_Paulo')::date),
                 'tem_reuniao',        na.tem_reuniao
               ) AS obj
        FROM novos_atual na
        LEFT JOIN public.profiles pf ON pf.id = na.owner_profile_id
        ORDER BY na.entrou_em DESC, na.id
        LIMIT 100
      ) x
    ), '[]'::jsonb),

    'por_gerente', CASE WHEN v_lider THEN jsonb_build_object(
      'colunas', (
        SELECT jsonb_agg(jsonb_build_object('chave', df.chave, 'rotulo', df.rotulo, 'formato', 'int')
                         ORDER BY df.ordem)
        FROM def df
      ),
      'linhas', coalesce((
          SELECT jsonb_agg(jsonb_build_object('gerente_id', ln.gid, 'nome', ln.nome, 'valores', ln.valores)
                           ORDER BY (ln.gid IS NULL), ln.nome, ln.gid)
          FROM linhas ln
        ), '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object(
             'gerente_id', NULL,
             'nome',       'Total',
             'valores',    (SELECT jsonb_agg(tt.valor ORDER BY tt.ordem) FROM tot tt)
            ))
    ) ELSE NULL END
  )
  INTO v_res;

  RETURN v_res;
END
$fn$;

COMMENT ON FUNCTION public.posvenda_app_resumo(date, date) IS
'App iPhone, Pós-venda, somente leitura. Período em data civil de Brasília (p_fim inclusivo, até 93 dias). '
'Gerente de relacionamento vê só o que é dele (reuniões pelo gerente_id, cartões pelo dono). Liderança '
'(admin, manager, coordenador) vê tudo e a tabela por gerente com linha Total. KPIs na régua do painel '
'comercial (Viabilidade 1; sem_desfecho e agendadas_futuras também só V1, V2 em chaves próprias). '
'Concluídas pela crm_cliente_timeline, creditadas ao dono do cartão. '
'Não devolve CPF, telefone, e-mail do cliente, observação nem transcrição: nome de cartão que é '
'e-mail ou só números sai como ''Cliente sem nome''.';

REVOKE ALL ON FUNCTION public.posvenda_app_resumo(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.posvenda_app_resumo(date, date) TO authenticated;