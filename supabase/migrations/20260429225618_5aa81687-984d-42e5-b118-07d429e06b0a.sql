-- =====================================================================
-- 1) Função: aplicar efeito colateral de aprovação de no-show
-- =====================================================================
-- Quando uma validação chega em final_status='approved' (auto-IA ou via
-- aprovação do gestor), garantimos:
--   a) attendee.status = 'no_show'
--   b) deal.stage_id   = stage de No-Show (R1 ou R2) na origem do deal
--
-- Roda como SECURITY DEFINER para conseguir atualizar attendee/deal
-- mesmo quando o usuário (manager) não teria permissão direta de UPDATE.

CREATE OR REPLACE FUNCTION public.apply_no_show_approval_effects(
  p_validation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attendee_id   uuid;
  v_deal_id       uuid;
  v_meeting_type  text;
  v_origin_id     uuid;
  v_target_stage  uuid;
BEGIN
  SELECT attendee_id, deal_id, COALESCE(meeting_type, 'r1')
    INTO v_attendee_id, v_deal_id, v_meeting_type
  FROM public.no_show_validations
  WHERE id = p_validation_id;

  -- a) marcar attendee como no_show (se ainda não estiver)
  IF v_attendee_id IS NOT NULL THEN
    UPDATE public.meeting_slot_attendees
       SET status = 'no_show'
     WHERE id = v_attendee_id
       AND status IS DISTINCT FROM 'no_show';
  END IF;

  -- b) mover deal para stage de No-Show da MESMA origin
  IF v_deal_id IS NOT NULL THEN
    SELECT origin_id INTO v_origin_id
      FROM public.crm_deals
     WHERE id = v_deal_id;

    IF v_origin_id IS NOT NULL THEN
      IF v_meeting_type = 'r2' THEN
        SELECT id INTO v_target_stage
          FROM public.crm_stages
         WHERE origin_id = v_origin_id
           AND (
             stage_name ILIKE 'No-Show R2'
             OR stage_name ILIKE 'No-Show Closer'
             OR stage_name ILIKE 'No-show R2'
           )
         LIMIT 1;
      ELSE
        SELECT id INTO v_target_stage
          FROM public.crm_stages
         WHERE origin_id = v_origin_id
           AND (
             stage_name ILIKE 'No-Show'
             OR stage_name ILIKE 'No-show'
             OR stage_name ILIKE 'NoShow'
           )
         LIMIT 1;
      END IF;

      IF v_target_stage IS NOT NULL THEN
        UPDATE public.crm_deals
           SET stage_id = v_target_stage
         WHERE id = v_deal_id
           AND stage_id IS DISTINCT FROM v_target_stage;
      END IF;
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_no_show_approval_effects(uuid) TO authenticated;

-- =====================================================================
-- 2) Trigger: aplicar automaticamente quando final_status vira 'approved'
-- =====================================================================
CREATE OR REPLACE FUNCTION public.trg_no_show_validation_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Dispara em INSERT já approved (fluxo auto-IA) e em UPDATE que vira approved
  IF NEW.final_status = 'approved'
     AND (TG_OP = 'INSERT' OR OLD.final_status IS DISTINCT FROM 'approved')
  THEN
    PERFORM public.apply_no_show_approval_effects(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS no_show_validation_apply_effects ON public.no_show_validations;
CREATE TRIGGER no_show_validation_apply_effects
AFTER INSERT OR UPDATE OF final_status, manager_review_status
ON public.no_show_validations
FOR EACH ROW
EXECUTE FUNCTION public.trg_no_show_validation_approval();

-- =====================================================================
-- 3) Backfill retroativo
-- Aplica efeito a todas as validações já aprovadas em que o attendee
-- ainda não está como no_show OU o deal não está em stage de No-Show.
-- =====================================================================
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT v.id
      FROM public.no_show_validations v
      LEFT JOIN public.meeting_slot_attendees a ON a.id = v.attendee_id
      LEFT JOIN public.crm_deals d ON d.id = v.deal_id
      LEFT JOIN public.crm_stages s ON s.id = d.stage_id
     WHERE v.final_status = 'approved'
       AND (
         (v.attendee_id IS NOT NULL AND a.status IS DISTINCT FROM 'no_show')
         OR (
           v.deal_id IS NOT NULL
           AND s.stage_name IS NOT NULL
           AND s.stage_name NOT ILIKE '%No-Show%'
           AND s.stage_name NOT ILIKE '%No-show%'
           AND s.stage_name NOT ILIKE '%NoShow%'
         )
       )
  LOOP
    PERFORM public.apply_no_show_approval_effects(r.id);
  END LOOP;
END$$;