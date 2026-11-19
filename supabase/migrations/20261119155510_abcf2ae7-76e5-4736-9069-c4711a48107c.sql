CREATE OR REPLACE FUNCTION public.pos_venda_contexto_encaminhamento(p_deal_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; r record; g record; v_nota text; v_ger text; v_trechos jsonb := '[]'::jsonb;
  arr jsonb; n int; i int; txt text; ultimo int := -2; qtd int := 0; total int := 0;
  kw constant text := '(carta de credito|consorcio|renda passiva|locacao|aluguel|alavanc|credito imobiliario)';
BEGIN
  IF auth.uid() IS NULL OR NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'coordenador')
     OR has_role(auth.uid(),'closer') OR has_role(auth.uid(),'closer_sombra') OR has_role(auth.uid(),'sdr')
     OR has_role(auth.uid(),'gerente_relacionamento')) THEN RETURN NULL; END IF;

  SELECT * INTO t FROM crm_cliente_timeline
   WHERE deal_destino_id = p_deal_id AND evento IN ('encaminhamento_bu','encaminhado_bu')
   ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT full_name INTO v_ger FROM profiles WHERE id = t.actor_id;

  SELECT coalesce(nullif(trim(a.notes),''), nullif(trim(s.notes),'')) INTO v_nota
    FROM meeting_slot_attendees a JOIN meeting_slots s ON s.id = a.meeting_slot_id
   WHERE a.deal_id = p_deal_id AND a.created_at >= t.created_at - interval '5 minutes'
   ORDER BY a.created_at ASC LIMIT 1;
  IF v_nota IS NULL AND t.nota IS NOT NULL AND t.nota NOT LIKE 'Encaminhado para %' THEN v_nota := t.nota; END IF;

  SELECT id, inicio INTO r FROM pos_venda_reunioes
   WHERE deal_id = t.deal_id AND status = 'realizada' AND inicio <= t.created_at + interval '1 day'
   ORDER BY inicio DESC LIMIT 1;
  IF FOUND THEN
    SELECT * INTO g FROM pos_venda_gravacoes_da_reuniao(r.id) x ORDER BY x.started_at DESC LIMIT 1;
    IF FOUND AND jsonb_typeof(g.transcript) = 'array' THEN
      arr := g.transcript; n := jsonb_array_length(arr);
      FOR i IN 0..n-1 LOOP
        IF lower(unaccent(coalesce(arr->i->>'transcript',''))) ~ kw AND i > ultimo + 1 THEN
          txt := btrim(concat_ws(' ', CASE WHEN i>0 THEN arr->(i-1)->>'transcript' END, arr->i->>'transcript', CASE WHEN i<n-1 THEN arr->(i+1)->>'transcript' END));
          ultimo := i + 1; v_trechos := v_trechos || to_jsonb(txt);
          qtd := qtd + 1; total := total + length(txt);
          EXIT WHEN qtd >= 8 OR total >= 2000;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'encaminhado_em', t.created_at, 'gerente', v_ger, 'deal_origem_id', t.deal_id,
    'nota_encaminhamento', v_nota,
    'reuniao_inicio', r.inicio,
    'tem_gravacao', g.id IS NOT NULL,
    'resumo', CASE WHEN g.id IS NULL THEN NULL WHEN jsonb_typeof(g.summary)='string' THEN g.summary #>> '{}' ELSE g.summary->>'summary' END,
    'trechos', v_trechos,
    'transcricao', CASE WHEN g.id IS NOT NULL AND jsonb_typeof(g.transcript)='array' THEN g.transcript ELSE '[]'::jsonb END);
END $$;
REVOKE ALL ON FUNCTION public.pos_venda_contexto_encaminhamento(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_venda_contexto_encaminhamento(uuid) TO authenticated, service_role;