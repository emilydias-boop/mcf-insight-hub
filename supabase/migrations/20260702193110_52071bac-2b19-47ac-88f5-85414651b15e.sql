
-- Tokens públicos para dashboards BI
CREATE TABLE public.bi_public_tokens (
  token TEXT PRIMARY KEY,
  bu TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
GRANT SELECT ON public.bi_public_tokens TO authenticated;
GRANT ALL ON public.bi_public_tokens TO service_role;
ALTER TABLE public.bi_public_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins veem tokens" ON public.bi_public_tokens FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- Semente do token (usuário poderá gerar mais depois no SQL)
INSERT INTO public.bi_public_tokens(token, bu, note)
VALUES (encode(gen_random_bytes(18),'hex'), 'consorcio', 'BI Consórcio - TV pública inicial');

-- RPC pública para BI Consórcio (agregado, sem PII)
CREATE OR REPLACE FUNCTION public.get_bi_public_consorcio(_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valid BOOLEAN;
  v_month_ref DATE := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
  v_month_end DATE := (date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '1 month - 1 day')::date;
  v_meta NUMERIC := 0;
  v_dias JSONB := NULL;
  v_daily JSONB;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.bi_public_tokens
    WHERE token = _token AND bu = 'consorcio' AND active = true
  ) INTO v_valid;
  IF NOT v_valid THEN
    RETURN jsonb_build_object('error','invalid_token');
  END IF;

  SELECT COALESCE(meta_valor,0), dias_uteis_override
    INTO v_meta, v_dias
  FROM public.consorcio_bi_metas
  WHERE month_ref = v_month_ref
  LIMIT 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('d', d, 'v', v) ORDER BY d), '[]'::jsonb)
    INTO v_daily
  FROM (
    SELECT to_char(COALESCE(proposal_date, created_at::date), 'YYYY-MM-DD') AS d,
           SUM(COALESCE(valor_credito,0))::numeric AS v
    FROM public.consorcio_proposals
    WHERE COALESCE(proposal_date, created_at::date) BETWEEN v_month_ref AND v_month_end
    GROUP BY 1
  ) x;

  RETURN jsonb_build_object(
    'month_ref', v_month_ref,
    'meta', v_meta,
    'dias_uteis_override', v_dias,
    'daily', v_daily
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_bi_public_consorcio(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_bi_public_consorcio(TEXT) TO anon, authenticated;
