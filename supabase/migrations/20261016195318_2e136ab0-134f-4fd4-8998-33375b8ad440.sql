CREATE OR REPLACE FUNCTION public.academia_atribuir_trilhas(_user_id uuid, _template_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
 v_perfil public.academia_perfis%ROWTYPE;
 v_tpl public.academia_track_templates%ROWTYPE;
 v_global uuid;
 v_principal uuid;
 v_track uuid;
 v_id uuid;
 v_novas int;
 v_resultado jsonb := '[]'::jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.academia_is_admin() THEN
  RAISE EXCEPTION 'sem_permissao: somente admin e RH podem atribuir trilhas' USING ERRCODE='42501';
 END IF;
 IF coalesce(cardinality(_template_ids),0)=0 OR array_position(_template_ids,NULL) IS NOT NULL THEN
  RAISE EXCEPTION 'selecao_invalida: selecione uma ou mais trilhas';
 END IF;
 SELECT * INTO v_perfil FROM public.academia_perfis WHERE id=_user_id FOR UPDATE;
 IF NOT FOUND OR v_perfil.status='encerrado' THEN
  RAISE EXCEPTION 'colaborador_invalido: colaborador não disponível na Academia';
 END IF;
 IF EXISTS (SELECT 1 FROM unnest(_template_ids) s(id) LEFT JOIN public.academia_track_templates t ON t.id=s.id WHERE t.id IS NULL OR NOT t.publicado) THEN
  RAISE EXCEPTION 'trilha_invalida: selecione somente trilhas publicadas';
 END IF;
 -- Initialize the same standard integration as first access, for this selected user.
 SELECT id INTO v_principal FROM public.academia_user_tracks WHERE user_id=_user_id AND tipo='principal';
 IF v_principal IS NULL THEN
  SELECT id INTO v_global FROM public.academia_track_templates WHERE frente_id IS NULL AND publicado ORDER BY versao DESC,created_at DESC LIMIT 1;
  IF v_global IS NULL THEN RAISE EXCEPTION 'sem_template: nenhum template global publicado'; END IF;
  INSERT INTO public.academia_user_tracks(user_id,track_template_id,tipo,frente_id) VALUES (_user_id,v_global,'principal',v_perfil.frente_id) RETURNING id INTO v_principal;
  INSERT INTO public.academia_user_tasks(user_track_id,user_id,task_id)
  SELECT v_principal,_user_id,t.id FROM public.academia_tasks t JOIN public.academia_modules m ON m.id=t.module_id JOIN public.academia_phases ph ON ph.id=m.phase_id
  WHERE (ph.track_template_id=v_global OR (ph.codigo='fase_1' AND ph.track_template_id=(SELECT id FROM public.academia_track_templates WHERE frente_id=v_perfil.frente_id AND publicado ORDER BY versao DESC,created_at DESC LIMIT 1)))
   AND NOT EXISTS (SELECT 1 FROM public.academia_user_tasks x WHERE x.user_id=_user_id AND x.task_id=t.id)
  ON CONFLICT DO NOTHING;
  UPDATE public.academia_perfis SET status='em_trilha',updated_at=now() WHERE id=_user_id AND status='ativo';
 END IF;
 FOR v_id IN SELECT DISTINCT unnest(_template_ids) LOOP
  SELECT * INTO v_tpl FROM public.academia_track_templates WHERE id=v_id;
  SELECT id INTO v_track FROM public.academia_user_tracks WHERE user_id=_user_id AND track_template_id=v_id LIMIT 1;
  IF v_track IS NOT NULL THEN
   v_resultado := v_resultado || jsonb_build_array(jsonb_build_object('template_id',v_id,'resultado','ja_atribuida','tarefas',0));
   CONTINUE;
  END IF;
  SELECT count(*) INTO v_novas FROM public.academia_tasks t JOIN public.academia_modules m ON m.id=t.module_id JOIN public.academia_phases ph ON ph.id=m.phase_id
  WHERE ph.track_template_id=v_id AND NOT EXISTS (SELECT 1 FROM public.academia_user_tasks x WHERE x.user_id=_user_id AND x.task_id=t.id);
  IF v_novas=0 THEN
   v_resultado := v_resultado || jsonb_build_array(jsonb_build_object('template_id',v_id,'resultado','ja_contemplada','tarefas',0));
   CONTINUE;
  END IF;
  -- Preserve the existing one-extension-per-front constraint.
  IF v_tpl.frente_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.academia_user_tracks WHERE user_id=_user_id AND tipo='extensao' AND frente_id=v_tpl.frente_id) THEN
   RAISE EXCEPTION 'frente_ja_atribuida: o colaborador já possui uma trilha adicional desta frente';
  END IF;
  INSERT INTO public.academia_user_tracks(user_id,track_template_id,tipo,frente_id) VALUES (_user_id,v_id,'extensao',v_tpl.frente_id) RETURNING id INTO v_track;
  INSERT INTO public.academia_user_tasks(user_track_id,user_id,task_id)
  SELECT v_track,_user_id,t.id FROM public.academia_tasks t JOIN public.academia_modules m ON m.id=t.module_id JOIN public.academia_phases ph ON ph.id=m.phase_id
  WHERE ph.track_template_id=v_id AND NOT EXISTS (SELECT 1 FROM public.academia_user_tasks x WHERE x.user_id=_user_id AND x.task_id=t.id)
  ON CONFLICT DO NOTHING;
  v_resultado := v_resultado || jsonb_build_array(jsonb_build_object('template_id',v_id,'resultado','atribuida','tarefas',v_novas));
 END LOOP;
 RETURN v_resultado;
END;
$function$;
REVOKE ALL ON FUNCTION public.academia_atribuir_trilhas(uuid,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.academia_atribuir_trilhas(uuid,uuid[]) TO authenticated;