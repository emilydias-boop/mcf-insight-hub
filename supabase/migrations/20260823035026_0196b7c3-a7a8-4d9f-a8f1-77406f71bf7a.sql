ALTER TABLE public.consorcio_proposal_cartas
  ADD COLUMN IF NOT EXISTS declinada_at timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_declinio text,
  ADD COLUMN IF NOT EXISTS declinada_by uuid;

CREATE OR REPLACE FUNCTION public.tg_sync_proposal_cartas_agregado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal uuid := COALESCE(NEW.proposal_id, OLD.proposal_id);
  v_total numeric;
  v_qtd integer;
  v_prazo integer;
  v_tipo text;
BEGIN
  -- Cartas declinadas saem da soma: o valor da venda cai sem cancelar a venda.
  SELECT COALESCE(SUM(valor_credito), 0), COUNT(*)
    INTO v_total, v_qtd
  FROM public.consorcio_proposal_cartas
  WHERE proposal_id = v_proposal
    AND declinada_at IS NULL;

  IF v_qtd = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT prazo_meses, tipo_produto INTO v_prazo, v_tipo
  FROM public.consorcio_proposal_cartas
  WHERE proposal_id = v_proposal
    AND declinada_at IS NULL
  ORDER BY valor_credito DESC, ordem ASC
  LIMIT 1;

  UPDATE public.consorcio_proposals
     SET valor_credito = v_total,
         qtd_cartas = v_qtd,
         prazo_meses = v_prazo,
         tipo_produto = v_tipo
   WHERE id = v_proposal;

  RETURN COALESCE(NEW, OLD);
END;
$$;