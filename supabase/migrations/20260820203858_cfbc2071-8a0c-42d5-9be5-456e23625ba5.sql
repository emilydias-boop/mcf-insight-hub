CREATE TABLE public.consorcio_proposal_cartas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id uuid NOT NULL REFERENCES public.consorcio_proposals(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 1,
  valor_credito numeric NOT NULL,
  prazo_meses integer NOT NULL,
  tipo_produto text NOT NULL,
  pending_registration_id uuid NULL REFERENCES public.consorcio_pending_registrations(id) ON DELETE SET NULL,
  consortium_card_id uuid NULL REFERENCES public.consortium_cards(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consorcio_proposal_cartas TO authenticated;
GRANT ALL ON public.consorcio_proposal_cartas TO service_role;

ALTER TABLE public.consorcio_proposal_cartas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage proposal cartas"
ON public.consorcio_proposal_cartas FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX idx_consorcio_proposal_cartas_proposal ON public.consorcio_proposal_cartas(proposal_id);
CREATE INDEX idx_consorcio_proposal_cartas_pending ON public.consorcio_proposal_cartas(pending_registration_id);

-- validação de valor (trigger, não CHECK, para permitir evolução da regra)
CREATE OR REPLACE FUNCTION public.tg_validate_proposal_carta()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.valor_credito IS NULL OR NEW.valor_credito <= 0 THEN
    RAISE EXCEPTION 'valor_credito da carta deve ser maior que zero';
  END IF;
  IF NEW.prazo_meses IS NULL OR NEW.prazo_meses <= 0 THEN
    RAISE EXCEPTION 'prazo_meses da carta deve ser maior que zero';
  END IF;
  IF NEW.tipo_produto IS NULL OR btrim(NEW.tipo_produto) = '' THEN
    RAISE EXCEPTION 'tipo_produto da carta é obrigatório';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_proposal_carta
BEFORE INSERT OR UPDATE ON public.consorcio_proposal_cartas
FOR EACH ROW EXECUTE FUNCTION public.tg_validate_proposal_carta();

-- coluna agregada de contagem
ALTER TABLE public.consorcio_proposals
  ADD COLUMN IF NOT EXISTS qtd_cartas integer NOT NULL DEFAULT 1;

-- sincronização dos agregados legados da proposta
CREATE OR REPLACE FUNCTION public.tg_sync_proposal_cartas_agregado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_proposal uuid := COALESCE(NEW.proposal_id, OLD.proposal_id);
  v_total numeric;
  v_qtd integer;
  v_prazo integer;
  v_tipo text;
BEGIN
  SELECT COALESCE(SUM(valor_credito), 0), COUNT(*)
    INTO v_total, v_qtd
  FROM public.consorcio_proposal_cartas
  WHERE proposal_id = v_proposal;

  IF v_qtd = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT prazo_meses, tipo_produto INTO v_prazo, v_tipo
  FROM public.consorcio_proposal_cartas
  WHERE proposal_id = v_proposal
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

CREATE TRIGGER trg_sync_proposal_cartas_agregado
AFTER INSERT OR UPDATE OR DELETE ON public.consorcio_proposal_cartas
FOR EACH ROW EXECUTE FUNCTION public.tg_sync_proposal_cartas_agregado();

-- backfill: uma carta espelho por proposta com valor
INSERT INTO public.consorcio_proposal_cartas
  (proposal_id, ordem, valor_credito, prazo_meses, tipo_produto, consortium_card_id, created_by)
SELECT p.id, 1, p.valor_credito,
       COALESCE(NULLIF(p.prazo_meses, 0), 240),
       COALESCE(NULLIF(btrim(p.tipo_produto), ''), 'select'),
       p.consortium_card_id,
       p.created_by
FROM public.consorcio_proposals p
WHERE COALESCE(p.valor_credito, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.consorcio_proposal_cartas c WHERE c.proposal_id = p.id
  );

UPDATE public.consorcio_proposals SET qtd_cartas = 1
WHERE COALESCE(valor_credito, 0) = 0 AND qtd_cartas <> 1;

COMMENT ON COLUMN public.consorcio_proposals.valor_credito IS
  'LEGADO/AGREGADO: soma automática dos valores em consorcio_proposal_cartas. Mantido por compatibilidade; a verdade por carta está na tabela filha.';
COMMENT ON COLUMN public.consorcio_proposals.prazo_meses IS
  'LEGADO/APROXIMAÇÃO: prazo da carta de MAIOR crédito da proposta. Uma proposta pode ter cartas com prazos diferentes — a verdade está em consorcio_proposal_cartas.';
COMMENT ON COLUMN public.consorcio_proposals.tipo_produto IS
  'LEGADO/APROXIMAÇÃO: tipo de produto da carta de MAIOR crédito da proposta. Uma proposta pode misturar produtos — a verdade está em consorcio_proposal_cartas.';
COMMENT ON COLUMN public.consorcio_proposals.consortium_card_id IS
  'LEGADO: primeira cota vinculada à proposta. Com N cartas, o vínculo por carta está em consorcio_proposal_cartas.consortium_card_id.';
COMMENT ON COLUMN public.consorcio_proposals.qtd_cartas IS
  'Quantidade de cartas da proposta (sincronizada por trigger a partir de consorcio_proposal_cartas).';