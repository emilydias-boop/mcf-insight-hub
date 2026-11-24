DO $do$ DECLARE d text; o text:='RAISE EXCEPTION ''Preencha setor, centro de custo, cargo, título, descrição, local e início desejado'';'; BEGIN
 d:=pg_get_functiondef('public.gov_requisicao_validar'::regproc);
 IF position(o in d)=0 THEN RAISE EXCEPTION 'gov_requisicao_validar inesperada'; END IF;
 d:=replace(d,o,$r$RAISE EXCEPTION 'Falta preencher: %', concat_ws(', ',
   CASE WHEN NEW.titulo IS NULL OR btrim(NEW.titulo)='' THEN 'Título da vaga' END,
   CASE WHEN NEW.centro_custo IS NULL OR btrim(NEW.centro_custo)='' THEN 'Centro de custo' END,
   CASE WHEN NEW.departamento_id IS NULL THEN 'Setor da vaga' END,
   CASE WHEN NEW.cargo_catalogo_id IS NULL THEN 'Cargo' END,
   CASE WHEN NEW.missao IS NULL OR btrim(NEW.missao)='' THEN 'Missão' END,
   CASE WHEN NEW.responsabilidades IS NULL OR btrim(NEW.responsabilidades)='' THEN 'Responsabilidades' END,
   CASE WHEN NEW.requisitos_obrigatorios IS NULL OR btrim(NEW.requisitos_obrigatorios)='' THEN 'Requisitos obrigatórios' END,
   CASE WHEN NEW.competencias IS NULL OR btrim(NEW.competencias)='' THEN 'Competências' END,
   CASE WHEN NEW.indicadores IS NULL OR btrim(NEW.indicadores)='' THEN 'Indicadores' END,
   CASE WHEN NEW.local IS NULL OR btrim(NEW.local)='' THEN 'Local' END,
   CASE WHEN NEW.data_inicio IS NULL THEN 'Data desejada de início' END);$r$);
 EXECUTE d;
END $do$;