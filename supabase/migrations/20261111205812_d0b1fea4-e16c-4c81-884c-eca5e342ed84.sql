CREATE OR REPLACE FUNCTION public.pos_venda_html_texto(t text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
 SELECT btrim(regexp_replace(regexp_replace(
  replace(replace(replace(replace(replace(
   regexp_replace(regexp_replace(regexp_replace(regexp_replace(coalesce(t,''),
    '<a[^>]*title="Open transcript[^"]*"[^>]*>[^<]*</a>','','gi'),
    '<li[^>]*>',E'\n- ','gi'),
    '<br\s*/?>|</p>|</ul>|</strong>',E'\n','gi'),
    '<[^>]+>','','g'),
  '&amp;','&'),'&nbsp;',' '),'&quot;','"'),'&lt;','<'),'&gt;','>'),
  '[ \t]+',' ','g'),E'\n\\s*\n+',E'\n','g'), E' \n')
$$;

CREATE OR REPLACE FUNCTION public.pos_venda_registrar_resumo(p_reuniao_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; g record; email_cli text; html text; pos int; resumo text; passos text;
BEGIN
 SELECT pr.*, p.email gerente_email, d.contact_id INTO r
 FROM pos_venda_reunioes pr JOIN profiles p ON p.id=pr.gerente_id JOIN crm_deals d ON d.id=pr.deal_id
 WHERE pr.id=p_reuniao_id AND pr.status='realizada';
 IF NOT FOUND THEN RETURN 'ignorada'; END IF;
 IF EXISTS(SELECT 1 FROM deal_activities WHERE deal_id=r.deal_id::text AND activity_type='pos_venda_resumo_reuniao' AND metadata->>'reuniao_id'=r.id::text) THEN RETURN 'ja_registrada'; END IF;
 SELECT lower(btrim(email)) INTO email_cli FROM crm_contacts WHERE id=r.contact_id;
 IF email_cli IS NULL OR r.gerente_email IS NULL THEN RETURN 'sem_email'; END IF;
 SELECT mr.* INTO g FROM meeting_recordings mr
 WHERE mr.started_at BETWEEN r.inicio - interval '3 hours' AND r.inicio + interval '3 hours'
   AND (lower(mr.host_email)=lower(r.gerente_email) OR lower(r.gerente_email)=ANY(SELECT lower(x) FROM unnest(coalesce(mr.participant_emails,'{}')) x))
   AND email_cli=ANY(SELECT lower(btrim(x)) FROM unnest(coalesce(mr.participant_emails,'{}')) x)
   AND coalesce(mr.summary->>'summary','')<>''
 ORDER BY abs(extract(epoch FROM mr.started_at - r.inicio)) LIMIT 1;
 IF NOT FOUND THEN RETURN 'sem_gravacao'; END IF;
 html := g.summary->>'summary';
 pos := strpos(lower(html),'próximos passos');
 IF pos>0 THEN
  resumo := pos_venda_html_texto(left(html,pos-1));
  passos := pos_venda_html_texto(substr(html,pos+length('próximos passos')));
 ELSE resumo := pos_venda_html_texto(html); END IF;
 resumo := btrim(regexp_replace(resumo,'^\s*Resumo da Reunião\s*','','i'));
 passos := nullif(btrim(passos),'');
 INSERT INTO deal_activities(deal_id,activity_type,description,metadata)
 VALUES (r.deal_id::text,'pos_venda_resumo_reuniao',
  'Resumo da reunião ('||CASE r.tipo WHEN 'viabilidade_2' THEN 'Viabilidade 2' ELSE 'Viabilidade 1' END||' · '||to_char(r.inicio AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI')||')'||E'\n\n'||resumo||coalesce(E'\n\nPróximos passos:\n'||passos,''),
  jsonb_build_object('reuniao_id',r.id,'gravacao_id',g.id,'tipo',r.tipo,'data',r.inicio,'resumo',resumo,'proximos_passos',passos,'automatico',true));
 RETURN 'registrada';
END $$;

CREATE OR REPLACE FUNCTION public.pos_venda_reuniao_realizada() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE destino uuid; o_atual int; o_dest int; atual uuid;
BEGIN
 destino := CASE NEW.tipo WHEN 'viabilidade_1' THEN 'b05a0001-0000-4000-8000-000000000002'::uuid WHEN 'viabilidade_2' THEN 'b05a0001-0000-4000-8000-000000000003'::uuid END;
 SELECT stage_id INTO atual FROM crm_deals WHERE id=NEW.deal_id AND origin_id='b05a0000-0000-4000-8000-000000000002';
 SELECT stage_order INTO o_atual FROM crm_stages WHERE id=atual;
 SELECT stage_order INTO o_dest FROM crm_stages WHERE id=destino;
 IF destino IS NOT NULL AND o_dest IS NOT NULL AND coalesce(o_atual,-1) < o_dest THEN
  BEGIN
   PERFORM set_config('mcf.mov_contexto', jsonb_build_object('deal_id',NEW.deal_id,'origem','pos_venda_reuniao_realizada','motivo','reunião '||NEW.tipo||' realizada')::text, true);
   UPDATE crm_deals SET stage_id=destino, updated_at=now() WHERE id=NEW.deal_id;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Pós-venda: não moveu negócio % após reunião realizada: %', NEW.deal_id, SQLERRM;
  END;
 END IF;
 BEGIN PERFORM pos_venda_registrar_resumo(NEW.id);
 EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Pós-venda: falha ao registrar resumo %: %', NEW.id, SQLERRM; END;
 RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_pos_venda_reuniao_realizada ON public.pos_venda_reunioes;
CREATE TRIGGER trg_pos_venda_reuniao_realizada AFTER INSERT OR UPDATE OF status ON public.pos_venda_reunioes
 FOR EACH ROW WHEN (NEW.status='realizada') EXECUTE FUNCTION public.pos_venda_reuniao_realizada();

CREATE OR REPLACE FUNCTION public.pos_venda_gravacao_resumo() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE rid uuid;
BEGIN
 FOR rid IN SELECT pr.id FROM pos_venda_reunioes pr JOIN profiles p ON p.id=pr.gerente_id
  WHERE pr.status='realizada' AND NEW.started_at BETWEEN pr.inicio - interval '3 hours' AND pr.inicio + interval '3 hours'
   AND (lower(NEW.host_email)=lower(p.email) OR lower(p.email)=ANY(SELECT lower(x) FROM unnest(coalesce(NEW.participant_emails,'{}')) x))
 LOOP
  BEGIN PERFORM pos_venda_registrar_resumo(rid);
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Pós-venda: falha ao registrar resumo %: %', rid, SQLERRM; END;
 END LOOP;
 RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS zz_pos_venda_gravacao_resumo ON public.meeting_recordings;
CREATE TRIGGER zz_pos_venda_gravacao_resumo AFTER INSERT OR UPDATE OF summary ON public.meeting_recordings
 FOR EACH ROW WHEN (NEW.summary IS NOT NULL) EXECUTE FUNCTION public.pos_venda_gravacao_resumo();

REVOKE ALL ON FUNCTION public.pos_venda_registrar_resumo(uuid), public.pos_venda_reuniao_realizada(), public.pos_venda_gravacao_resumo() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_venda_registrar_resumo(uuid) TO service_role;