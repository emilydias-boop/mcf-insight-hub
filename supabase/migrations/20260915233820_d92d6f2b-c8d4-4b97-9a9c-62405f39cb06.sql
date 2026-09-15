CREATE TABLE public.crm_deal_icp_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  segmento_anterior text,
  segmento_novo text,
  alterado_por uuid,
  alterado_em timestamptz NOT NULL DEFAULT now(),
  origem text NOT NULL DEFAULT 'manual',
  contexto text
);

GRANT SELECT ON public.crm_deal_icp_historico TO authenticated;
GRANT ALL ON public.crm_deal_icp_historico TO service_role;

ALTER TABLE public.crm_deal_icp_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lideranca le historico de icp"
ON public.crm_deal_icp_historico
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'coordenador')
);

CREATE INDEX idx_crm_deal_icp_historico_deal_id ON public.crm_deal_icp_historico(deal_id);
CREATE INDEX idx_crm_deal_icp_historico_alterado_em ON public.crm_deal_icp_historico(alterado_em DESC);

CREATE OR REPLACE FUNCTION public.trg_log_icp_segment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.icp_segment IS DISTINCT FROM OLD.icp_segment THEN
    INSERT INTO public.crm_deal_icp_historico (
      deal_id, segmento_anterior, segmento_novo, alterado_por, origem, contexto
    ) VALUES (
      NEW.id,
      OLD.icp_segment,
      NEW.icp_segment,
      auth.uid(),
      CASE WHEN auth.uid() IS NULL THEN 'trigger_qualificacao' ELSE 'manual' END,
      NULL
    );
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_icp_segment_change ON public.crm_deals;
CREATE TRIGGER trg_log_icp_segment_change
AFTER UPDATE OF icp_segment ON public.crm_deals
FOR EACH ROW
EXECUTE FUNCTION public.trg_log_icp_segment_change();