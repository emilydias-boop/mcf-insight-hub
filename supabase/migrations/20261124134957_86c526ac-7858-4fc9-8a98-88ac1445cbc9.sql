DO $do$ DECLARE d text; o text:='RAISE EXCEPTION ''Preencha motivo, descrição, data prevista e justificativa'';'; BEGIN
 d:=pg_get_functiondef('gov_private.gov_desligamento_salvar(jsonb)'::regprocedure);
 IF position(o in d)=0 THEN RAISE EXCEPTION 'gov_desligamento_salvar inesperada'; END IF;
 d:=replace(d,o,$r$RAISE EXCEPTION 'Falta preencher: %', concat_ws(', ',
   CASE WHEN btrim(r.motivo)='' THEN 'Motivo' END,
   CASE WHEN btrim(r.descricao)='' THEN 'Descrição' END,
   CASE WHEN r.data_prevista IS NULL THEN 'Data prevista' END,
   CASE WHEN btrim(r.justificativa)='' THEN 'Justificativa' END);$r$);
 EXECUTE d;
END $do$;