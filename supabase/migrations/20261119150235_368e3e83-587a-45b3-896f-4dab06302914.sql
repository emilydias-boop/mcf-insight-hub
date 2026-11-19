CREATE OR REPLACE FUNCTION public.pos_venda_trechos_consorcio(p_deal_id uuid)
RETURNS TABLE(reuniao_inicio timestamptz, trecho text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; g record; arr jsonb; n int; i int; txt text; total int := 0; qtd int := 0; ultimo int;
  kw constant text := '(carta de credito|consorcio|renda passiva|locacao|aluguel|alavanc|credito imobiliario)';
BEGIN
 IF NOT public.pos_venda_tem_acesso() THEN RETURN; END IF;
 FOR r IN SELECT id, inicio FROM pos_venda_reunioes WHERE deal_id=p_deal_id AND status='realizada' ORDER BY inicio DESC LOOP
  SELECT * INTO g FROM pos_venda_gravacoes_da_reuniao(r.id) x WHERE jsonb_typeof(x.transcript)='array' ORDER BY x.started_at DESC LIMIT 1;
  IF NOT FOUND THEN CONTINUE; END IF;
  arr := g.transcript; n := jsonb_array_length(arr); ultimo := -2;
  FOR i IN 0..n-1 LOOP
   IF lower(unaccent(coalesce(arr->i->>'transcript',''))) ~ kw AND i > ultimo + 1 THEN
    txt := btrim(concat_ws(' ', CASE WHEN i>0 THEN arr->(i-1)->>'transcript' END, arr->i->>'transcript', CASE WHEN i<n-1 THEN arr->(i+1)->>'transcript' END));
    ultimo := i + 1;
    reuniao_inicio := r.inicio; trecho := txt; RETURN NEXT;
    qtd := qtd + 1; total := total + length(txt);
    IF qtd >= 8 OR total >= 2000 THEN RETURN; END IF;
   END IF;
  END LOOP;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.pos_venda_trechos_consorcio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_venda_trechos_consorcio(uuid) TO authenticated, service_role;