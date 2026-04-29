CREATE OR REPLACE FUNCTION public.notify_no_show_review_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_name TEXT;
  v_title TEXT;
  v_msg TEXT;
  v_type TEXT;
BEGIN
  IF (TG_OP = 'UPDATE')
     AND NEW.manager_review_status IN ('approved','rejected')
     AND COALESCE(OLD.manager_review_status,'') IS DISTINCT FROM NEW.manager_review_status
     AND NEW.performed_by IS NOT NULL
  THEN
    BEGIN
      SELECT COALESCE(d.name, 'lead')
        INTO v_lead_name
        FROM public.crm_deals d
       WHERE d.id = NEW.deal_id
       LIMIT 1;
    EXCEPTION WHEN others THEN
      v_lead_name := 'lead';
    END;

    IF NEW.manager_review_status = 'approved' THEN
      v_title := 'No-Show aprovado pelo gestor';
      v_msg := COALESCE(v_lead_name,'lead') ||
               ' — sua contestação de No-Show foi APROVADA. A reunião foi marcada como No-Show.';
      v_type := 'info';
    ELSE
      v_title := 'No-Show rejeitado pelo gestor';
      v_msg := COALESCE(v_lead_name,'lead') ||
               ' — sua contestação de No-Show foi REJEITADA. Você pode enviar uma nova evidência.';
      v_type := 'warning';
    END IF;

    INSERT INTO public.user_notifications (user_id, type, title, message, action_url, metadata, read)
    VALUES (
      NEW.performed_by,
      v_type,
      v_title,
      v_msg,
      '/crm/meus-no-shows',
      jsonb_build_object(
        'validation_id', NEW.id,
        'deal_id', NEW.deal_id,
        'meeting_slot_id', NEW.meeting_slot_id,
        'attendee_id', NEW.attendee_id,
        'manager_review_status', NEW.manager_review_status,
        'manager_review_notes', NEW.manager_review_notes
      ),
      false
    );

    -- Quando REJEITADO: liberar a reunião para o SDR poder reenviar evidência.
    IF NEW.manager_review_status = 'rejected' AND NEW.attendee_id IS NOT NULL THEN
      UPDATE public.meeting_slot_attendees
         SET status = 'invited',
             updated_at = now()
       WHERE id = NEW.attendee_id
         AND status = 'no_show';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;