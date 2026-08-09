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

CREATE OR REPLACE FUNCTION public.autolink_orphan_a000_transactions(p_limit integer DEFAULT 10000)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx record;
  v_deal uuid;
  v_crit text;
  v_att uuid;
  v_cnt integer;
  v_linked integer := 0;
  v_amb integer := 0;
  v_none integer := 0;
BEGIN
  PERFORM set_config('app.autolink_backfill', 'on', true);
  CREATE TEMP TABLE IF NOT EXISTS tmp_cand(deal_id uuid) ON COMMIT DROP;

  FOR v_tx IN
    SELECT id, lower(trim(customer_email)) AS em,
           right(regexp_replace(coalesce(customer_phone,''),'\D','','g'),9) AS ph9,
           sale_date
    FROM public.hubla_transactions
    WHERE product_name ILIKE 'A000%' AND linked_deal_id IS NULL
    ORDER BY sale_date DESC
    LIMIT p_limit
  LOOP
    v_deal := NULL; v_crit := NULL; v_att := NULL; v_cnt := 0;
    DELETE FROM tmp_cand;

    IF v_tx.em IS NOT NULL AND v_tx.em <> '' THEN
      INSERT INTO tmp_cand
      SELECT DISTINCT d.id FROM public.crm_contacts c
      JOIN public.crm_deals d ON d.contact_id = c.id
      WHERE lower(trim(c.email)) = v_tx.em;
      SELECT count(*) INTO v_cnt FROM tmp_cand;
      IF v_cnt > 0 THEN v_crit := 'email'; END IF;
    END IF;

    IF coalesce(v_cnt,0) = 0 AND length(v_tx.ph9) = 9 THEN
      INSERT INTO tmp_cand
      SELECT DISTINCT d.id FROM public.crm_contacts c
      JOIN public.crm_deals d ON d.contact_id = c.id
      WHERE right(regexp_replace(coalesce(c.phone,''),'\D','','g'),9) = v_tx.ph9;
      SELECT count(*) INTO v_cnt FROM tmp_cand;
      IF v_cnt > 0 THEN v_crit := 'telefone'; END IF;
    END IF;

    IF coalesce(v_cnt,0) = 0 THEN
      v_none := v_none + 1;
      CONTINUE;
    END IF;

    IF v_cnt = 1 THEN
      SELECT deal_id INTO v_deal FROM tmp_cand;
    ELSE
      WITH inc AS (
        SELECT t.deal_id FROM tmp_cand t
        JOIN public.crm_deals d ON d.id = t.deal_id
        JOIN public.bu_origin_mapping m ON m.entity_id = d.origin_id AND m.bu = 'incorporador'
      ), best AS (
        SELECT i.deal_id, min(abs(extract(epoch FROM (ms.scheduled_at - v_tx.sale_date)))) AS dist
        FROM inc i
        JOIN public.meeting_slot_attendees a ON a.deal_id = i.deal_id
        JOIN public.meeting_slots ms ON ms.id = a.meeting_slot_id
        WHERE coalesce(ms.status,'') NOT ILIKE '%cancel%'
        GROUP BY i.deal_id
      )
      SELECT deal_id INTO v_deal FROM best
      WHERE dist = (SELECT min(dist) FROM best)
        AND (SELECT count(*) FROM best b2 WHERE b2.dist = (SELECT min(dist) FROM best)) = 1;

      IF v_deal IS NULL THEN
        v_amb := v_amb + 1;
        CONTINUE;
      END IF;
      v_crit := v_crit || '_desempate';
    END IF;

    SELECT a.id INTO v_att
    FROM public.meeting_slot_attendees a
    JOIN public.meeting_slots ms ON ms.id = a.meeting_slot_id
    WHERE a.deal_id = v_deal
      AND coalesce(ms.status,'') NOT ILIKE '%cancel%'
      AND coalesce(ms.meeting_type,'r1') IN ('r1','r2')
    ORDER BY ms.scheduled_at DESC
    LIMIT 1;

    UPDATE public.hubla_transactions
    SET linked_deal_id = v_deal,
        linked_attendee_id = coalesce(linked_attendee_id, v_att),
        linked_method = 'auto',
        linked_at = now()
    WHERE id = v_tx.id AND linked_deal_id IS NULL;

    INSERT INTO public.hubla_transaction_autolink_log(transacao_id, deal_id, attendee_id, criterio)
    VALUES (v_tx.id, v_deal, v_att, v_crit);

    v_linked := v_linked + 1;
  END LOOP;

  RETURN jsonb_build_object('vinculadas', v_linked, 'ambiguas', v_amb, 'sem_match', v_none);
END;
$$;