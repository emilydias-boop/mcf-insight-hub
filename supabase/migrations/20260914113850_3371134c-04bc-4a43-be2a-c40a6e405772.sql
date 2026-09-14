CREATE OR REPLACE FUNCTION public.enqueue_outbound_sale_linked_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cfg RECORD;
  payload JSONB;
BEGIN
  IF coalesce(current_setting('app.autolink_backfill', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.linked_attendee_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.linked_attendee_id IS NOT DISTINCT FROM NEW.linked_attendee_id THEN
    RETURN NEW;
  END IF;

  -- 2026-09-14 (decisão do dono): correção retroativa de atribuição NÃO é evento
  -- de saída. O modal "Contratos não atribuídos" grava linked_method =
  -- 'manual_sugestao' ao consertar o vínculo de uma venda antiga; isso é conserto
  -- de cadastro, não notícia de venda. Sem este corte, ativar um webhook de
  -- 'sale.linked' faria cada correção disparar evento para fora, semanas depois
  -- da venda. Intencional — não remover.
  IF NEW.linked_method = 'manual_sugestao' THEN
    RETURN NEW;
  END IF;

  IF NEW.source IS NULL OR NEW.source NOT IN ('hubla','kiwify','mcfpay','make','asaas','manual') THEN
    RETURN NEW;
  END IF;

  payload := public.build_sale_webhook_payload(NEW, 'sale.linked');

  FOR cfg IN
    SELECT * FROM public.outbound_webhook_configs
    WHERE is_active = true
      AND 'sale.linked' = ANY(events)
      AND NEW.source = ANY(sources)
      AND (product_categories IS NULL OR array_length(product_categories,1) IS NULL OR NEW.product_category = ANY(product_categories))
  LOOP
    INSERT INTO public.outbound_webhook_queue (config_id, event, transaction_id, payload)
    VALUES (cfg.id, 'sale.linked', NEW.id, payload);
  END LOOP;

  RETURN NEW;
END;
$function$;