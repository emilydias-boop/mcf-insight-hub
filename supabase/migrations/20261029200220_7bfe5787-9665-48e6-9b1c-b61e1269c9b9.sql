ALTER TABLE public.consorcio_lance_history ADD COLUMN IF NOT EXISTS tipo_lance text;
CREATE OR REPLACE FUNCTION public.consorcio_validar_tipo_lance() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.tipo_lance IS NOT NULL AND NEW.tipo_lance NOT IN ('embutido','livre','fixo') THEN
    RAISE EXCEPTION 'tipo_lance inválido: %', NEW.tipo_lance;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_consorcio_validar_tipo_lance ON public.consorcio_lance_history;
CREATE TRIGGER trg_consorcio_validar_tipo_lance BEFORE INSERT OR UPDATE ON public.consorcio_lance_history
FOR EACH ROW EXECUTE FUNCTION public.consorcio_validar_tipo_lance();

CREATE TABLE public.consorcio_harvey_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.consortium_cards(id) ON DELETE CASCADE,
  mes_referencia text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  http_status int,
  erro text,
  payload jsonb,
  enviado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (card_id, mes_referencia)
);
GRANT SELECT ON public.consorcio_harvey_envios TO authenticated;
GRANT ALL ON public.consorcio_harvey_envios TO service_role;
ALTER TABLE public.consorcio_harvey_envios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins veem envios HARVEY" ON public.consorcio_harvey_envios FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.consorcio_periodo_mes(p text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT CASE WHEN length(d)=6 AND substr(d,1,2)::int BETWEEN 1 AND 12 AND substr(d,3,4) LIKE '20%'
              THEN substr(d,3,4)||'-'||substr(d,1,2) END
  FROM (SELECT regexp_replace(coalesce(p,''),'\D','','g') d) x
$$;

CREATE OR REPLACE FUNCTION public.consorcio_relatorio_cota(p_card_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c record; meses jsonb;
BEGIN
  IF NOT public.can_access_consorcio_pii(auth.uid()) AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'sem acesso' USING ERRCODE='42501';
  END IF;
  SELECT id, nome_completo, razao_social, cpf, cnpj, email, grupo, cota, valor_credito, tipo_produto,
         data_contratacao, data_contemplacao, motivo_contemplacao
    INTO c FROM consortium_cards WHERE id = p_card_id;
  IF c.id IS NULL THEN RETURN NULL; END IF;

  WITH cal AS (
    SELECT to_char(data_assembleia,'YYYY-MM') mes, numero, data_assembleia, sorteio
    FROM consorcio_calendario_assembleia WHERE grupo = c.grupo
  ), lot AS (
    SELECT DISTINCT ON (consorcio_periodo_mes(periodo)) consorcio_periodo_mes(periodo) mes,
           numero_loteria, numero_aplicado, (created_at AT TIME ZONE 'America/Sao_Paulo')::date consultado_em
    FROM consorcio_consulta_loteria
    WHERE grupo = c.grupo AND consorcio_periodo_mes(periodo) IS NOT NULL
    ORDER BY consorcio_periodo_mes(periodo), created_at DESC
  ), lan AS (
    SELECT to_char(created_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') mes,
           jsonb_agg(jsonb_build_object('data',(created_at AT TIME ZONE 'America/Sao_Paulo')::date,
             'tipo',tipo_lance,'percentual',percentual_lance,'valor',valor_lance,
             'chance',chance_classificacao,'posicao_estimada',posicao_estimada) ORDER BY created_at) lances
    FROM consorcio_lance_history WHERE card_id = c.id GROUP BY 1
  ), res AS (
    SELECT to_char(data_assembleia,'YYYY-MM') mes,
           jsonb_agg(jsonb_build_object('modalidade',modalidade,'percentual',percentual_lance,'data',dt_contemplacao)) resultados
    FROM consorcio_assembleia_resultados
    WHERE grupo = c.grupo AND cota = c.cota AND data_assembleia IS NOT NULL GROUP BY 1
  ), todos AS (
    SELECT mes FROM cal UNION SELECT mes FROM lot UNION SELECT mes FROM lan UNION SELECT mes FROM res
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'mes', t.mes,
      'assembleia', CASE WHEN cal.mes IS NULL THEN NULL ELSE jsonb_build_object('numero',cal.numero,'data',cal.data_assembleia,'sorteio',cal.sorteio) END,
      'loteria', CASE WHEN lot.mes IS NULL THEN NULL ELSE jsonb_build_object('numero',lot.numero_loteria,'aplicado',lot.numero_aplicado,'consultado_em',lot.consultado_em) END,
      'lances', coalesce(lan.lances,'[]'::jsonb),
      'resultados', coalesce(res.resultados,'[]'::jsonb)
    ) ORDER BY t.mes DESC),'[]'::jsonb)
  INTO meses
  FROM todos t
  LEFT JOIN cal ON cal.mes=t.mes LEFT JOIN lot ON lot.mes=t.mes
  LEFT JOIN lan ON lan.mes=t.mes LEFT JOIN res ON res.mes=t.mes
  WHERE t.mes >= to_char(coalesce(c.data_contratacao, '2000-01-01'::date),'YYYY-MM');

  RETURN jsonb_build_object(
    'cota', jsonb_build_object('id',c.id,'cliente',coalesce(c.nome_completo,c.razao_social),'cpf',c.cpf,'cnpj',c.cnpj,
      'email',c.email,'grupo',c.grupo,'cota',c.cota,'valor_credito',c.valor_credito,'tipo_produto',c.tipo_produto,
      'data_contratacao',c.data_contratacao,'data_contemplacao',c.data_contemplacao,'motivo_contemplacao',c.motivo_contemplacao),
    'meses', meses);
END $$;
REVOKE ALL ON FUNCTION public.consorcio_relatorio_cota(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.consorcio_relatorio_cota(uuid) TO authenticated, service_role;