-- 1) Fix do trigger: bypass para service_role/webhooks (auth.uid() IS NULL)
CREATE OR REPLACE FUNCTION public.enforce_meeting_status_lock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ano_mes text;
  v_scheduled timestamptz;
  v_days int;
  v_locked boolean;
  v_is_privileged boolean;
  v_is_service boolean;
  v_blocked boolean := false;
  v_reason text := NULL;
  v_email text;
  v_role text;
  v_closer text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT scheduled_at INTO v_scheduled
  FROM public.meeting_slots WHERE id = NEW.meeting_slot_id;

  IF v_scheduled IS NULL THEN
    RETURN NEW;
  END IF;

  v_ano_mes := to_char(v_scheduled, 'YYYY-MM');
  v_days := (now()::date - v_scheduled::date);
  v_locked := public.is_month_locked(v_ano_mes);
  v_is_service := (auth.uid() IS NULL);

  v_is_privileged := v_is_service
                  OR public.has_role(auth.uid(), 'admin')
                  OR public.has_role(auth.uid(), 'manager')
                  OR public.has_role(auth.uid(), 'coordenador');

  IF v_locked AND NOT v_is_privileged THEN
    v_blocked := true;
    v_reason := 'Mês ' || v_ano_mes || ' está fechado';
  END IF;

  IF v_days >= 1 AND NOT v_is_service THEN
    SELECT email INTO v_email FROM public.profiles WHERE id = auth.uid();
    SELECT string_agg(role::text, ', ') INTO v_role FROM public.user_roles WHERE user_id = auth.uid();
    SELECT c.name INTO v_closer
      FROM public.meeting_slots ms
      LEFT JOIN public.closers c ON c.id = ms.closer_id
      WHERE ms.id = NEW.meeting_slot_id;

    INSERT INTO public.late_status_change_attempts (
      attendee_id, slot_id, meeting_scheduled_at, ano_mes,
      old_status, new_status, days_after_meeting, was_blocked, block_reason,
      attempted_by, attempted_by_email, attempted_by_role,
      attendee_name, closer_name
    ) VALUES (
      NEW.id, NEW.meeting_slot_id, v_scheduled, v_ano_mes,
      OLD.status, NEW.status, v_days, v_blocked, v_reason,
      auth.uid(), v_email, v_role,
      NEW.attendee_name, v_closer
    );
  END IF;

  IF v_blocked THEN
    RAISE EXCEPTION
      'Mês % está fechado. Alterações de status estão bloqueadas. Solicite ao gestor/admin para reabrir.',
      v_ano_mes
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Backfill attendees → contract_paid
UPDATE public.meeting_slot_attendees
SET status='contract_paid', contract_paid_at='2026-05-21 21:47:03.365+00'::timestamptz, updated_at=now()
WHERE id='2a9b6612-da5f-42f6-b39d-cf91b5162bac';

UPDATE public.meeting_slot_attendees
SET status='contract_paid', contract_paid_at='2026-05-21 21:44:18.25+00'::timestamptz, updated_at=now()
WHERE id='802cb85f-2de4-4ec7-a5a1-8d898d03d3f4';

UPDATE public.meeting_slot_attendees
SET status='contract_paid', contract_paid_at='2026-05-21 21:43:48.944+00'::timestamptz, updated_at=now()
WHERE id='b0360628-901b-4436-91f5-2b7cb6ddd33b';

UPDATE public.meeting_slot_attendees
SET status='contract_paid', contract_paid_at='2026-05-21 22:52:56.74+00'::timestamptz, updated_at=now()
WHERE id='bdd6728e-f4df-4756-9e2d-658740f2b4c6';

-- 3) Move deals → "Contrato Pago"
UPDATE public.crm_deals
SET stage_id='062927f5-b7a3-496a-9d47-eb03b3d69b10', stage_moved_at=now(), updated_at=now()
WHERE id IN (
  'f0a7efb8-8360-4d27-9451-595433494405',
  '8e816b9c-4e07-4e5a-89dd-253652e663d6',
  'c8dbb187-d5cc-45f2-8de8-ae2792ec84e2',
  '6f66e2eb-a87e-458a-b45c-ad307fc01204'
);

-- 4) Link Hubla transactions (linked_method aceita 'auto' | 'manual')
UPDATE public.hubla_transactions
SET linked_attendee_id='2a9b6612-da5f-42f6-b39d-cf91b5162bac',
    linked_deal_id='f0a7efb8-8360-4d27-9451-595433494405',
    linked_at=now(), linked_method='manual'
WHERE customer_email='marcosmuniz.adm@gmail.com'
  AND sale_date::date='2026-05-21' AND linked_attendee_id IS NULL;

UPDATE public.hubla_transactions
SET linked_attendee_id='802cb85f-2de4-4ec7-a5a1-8d898d03d3f4',
    linked_deal_id='8e816b9c-4e07-4e5a-89dd-253652e663d6',
    linked_at=now(), linked_method='manual'
WHERE customer_email='salomaolealnava@gmail.com'
  AND sale_date::date='2026-05-21' AND linked_attendee_id IS NULL;

UPDATE public.hubla_transactions
SET linked_attendee_id='b0360628-901b-4436-91f5-2b7cb6ddd33b',
    linked_deal_id='c8dbb187-d5cc-45f2-8de8-ae2792ec84e2',
    linked_at=now(), linked_method='manual'
WHERE customer_email='wesleyaguiar984@gmail.com'
  AND sale_date::date='2026-05-21' AND linked_attendee_id IS NULL;

UPDATE public.hubla_transactions
SET linked_attendee_id='bdd6728e-f4df-4756-9e2d-658740f2b4c6',
    linked_deal_id='6f66e2eb-a87e-458a-b45c-ad307fc01204',
    linked_at=now(), linked_method='manual'
WHERE customer_email='fernando.gads@gmail.com'
  AND sale_date::date='2026-05-21' AND linked_attendee_id IS NULL;