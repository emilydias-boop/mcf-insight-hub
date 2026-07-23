CREATE OR REPLACE FUNCTION public.trg_notify_attendee_contract_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_origin_id uuid;
  v_group_id uuid;
  v_is_incorporador boolean := false;
BEGIN
  IF NEW.contract_paid_at IS NOT NULL
     AND (OLD.contract_paid_at IS NULL OR OLD.contract_paid_at IS DISTINCT FROM NEW.contract_paid_at AND OLD.contract_paid_at IS NULL)
  THEN
    -- Ignora sócios
    IF COALESCE(NEW.is_partner, false) = true THEN
      RETURN NEW;
    END IF;

    -- Idempotência
    IF NEW.boas_vindas_r2_whatsapp_enviado_em IS NOT NULL THEN
      RETURN NEW;
    END IF;

    -- Deriva origin/group a partir do deal
    IF NEW.deal_id IS NOT NULL THEN
      SELECT d.origin_id, o.group_id
        INTO v_origin_id, v_group_id
      FROM public.crm_deals d
      LEFT JOIN public.crm_origins o ON o.id = d.origin_id
      WHERE d.id = NEW.deal_id;
    END IF;

    -- Filtro BU = incorporador (defesa em profundidade)
    SELECT EXISTS (
      SELECT 1 FROM public.bu_origin_mapping m
      WHERE m.bu = 'incorporador'
        AND (
          (m.entity_type = 'origin' AND m.entity_id = v_origin_id)
          OR (m.entity_type = 'group' AND m.entity_id = v_group_id)
        )
    ) INTO v_is_incorporador;

    IF NOT v_is_incorporador THEN
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url := 'https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/automation-event-dispatcher',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlaGNmZ3F2aWdmY2VraWlwcWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0Nzk1NzgsImV4cCI6MjA3OTA1NTU3OH0.Rab8S7rX6c7N92CufTkaXKJh0jpS9ydHWSmJMaPMVtE"}'::jsonb,
      body := jsonb_build_object(
        'event', 'attendee_contract_paid',
        'attendee_id', NEW.id
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;