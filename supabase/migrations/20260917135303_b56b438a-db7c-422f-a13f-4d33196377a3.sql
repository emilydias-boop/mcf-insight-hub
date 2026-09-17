CREATE TABLE public.consorcio_venda_webhook_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id uuid NOT NULL UNIQUE REFERENCES public.consorcio_proposals(id) ON DELETE CASCADE,
  payload jsonb,
  status text NOT NULL DEFAULT 'pending',
  tentativas integer NOT NULL DEFAULT 0,
  ultimo_erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

GRANT SELECT, INSERT ON public.consorcio_venda_webhook_queue TO authenticated;
GRANT ALL ON public.consorcio_venda_webhook_queue TO service_role;

ALTER TABLE public.consorcio_venda_webhook_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "queue_select_lideranca"
ON public.consorcio_venda_webhook_queue
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'coordenador')
);

CREATE POLICY "queue_insert_authenticated"
ON public.consorcio_venda_webhook_queue
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE INDEX idx_consorcio_venda_webhook_queue_pending
ON public.consorcio_venda_webhook_queue (status, created_at)
WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.enqueue_consorcio_venda_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só no instante em que a venda passa a existir como "aceita".
  IF NEW.status IS DISTINCT FROM 'aceita' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'aceita' THEN
    RETURN NEW;
  END IF;
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Uma venda gera no máximo UMA linha na fila. Nada retroativo: a fila nasce
  -- vazia e só recebe vendas lançadas a partir de agora.
  INSERT INTO public.consorcio_venda_webhook_queue (venda_id)
  VALUES (NEW.id)
  ON CONFLICT (venda_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_consorcio_venda_webhook ON public.consorcio_proposals;
CREATE TRIGGER trg_enqueue_consorcio_venda_webhook
AFTER INSERT OR UPDATE OF status ON public.consorcio_proposals
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_consorcio_venda_webhook();