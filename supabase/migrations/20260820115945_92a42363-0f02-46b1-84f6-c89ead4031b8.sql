ALTER TABLE public.meeting_slot_attendees
  ADD COLUMN IF NOT EXISTS booked_by_ajustado_por uuid,
  ADD COLUMN IF NOT EXISTS booked_by_ajustado_em timestamptz,
  ADD COLUMN IF NOT EXISTS booked_by_anterior uuid;

CREATE OR REPLACE FUNCTION public.listar_agendadores_disponiveis()
RETURNS TABLE (id uuid, full_name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email
    FROM public.profiles p
   WHERE coalesce(p.access_status, 'ativo') <> 'inativo'
     AND EXISTS (
       SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = p.id
          AND ur.role IN ('sdr','closer','closer_sombra','coordenador','manager','admin')
     )
   ORDER BY p.full_name NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.corrigir_agendador_reuniao(p_attendee_id uuid, p_booked_by uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_att public.meeting_slot_attendees;
  v_scheduled timestamptz;
  v_ano_mes text;
  v_locked boolean;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF NOT (
    has_role(v_actor, 'admin'::app_role) OR has_role(v_actor, 'manager'::app_role)
    OR has_role(v_actor, 'coordenador'::app_role) OR has_role(v_actor, 'sdr'::app_role)
    OR has_role(v_actor, 'closer'::app_role) OR has_role(v_actor, 'closer_sombra'::app_role)
  ) THEN
    RAISE EXCEPTION 'Seu perfil não permite alterar o agendador da reunião.';
  END IF;

  SELECT * INTO v_att FROM public.meeting_slot_attendees WHERE id = p_attendee_id;
  IF v_att.id IS NULL THEN
    RAISE EXCEPTION 'Participante da reunião não encontrado.';
  END IF;

  IF p_booked_by IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_booked_by) THEN
    RAISE EXCEPTION 'Agendador informado não existe.';
  END IF;

  IF v_att.booked_by IS NOT DISTINCT FROM p_booked_by THEN
    RETURN jsonb_build_object('status', 'sem_mudanca');
  END IF;

  SELECT scheduled_at INTO v_scheduled FROM public.meeting_slots WHERE id = v_att.meeting_slot_id;
  v_ano_mes := to_char(coalesce(v_scheduled, now()) AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM');
  SELECT coalesce(is_active, false) INTO v_locked
    FROM public.meeting_status_locks WHERE ano_mes = v_ano_mes;
  IF coalesce(v_locked, false) THEN
    RAISE EXCEPTION 'O mês % está fechado — o agendador desta reunião não pode mais ser alterado.', v_ano_mes;
  END IF;

  UPDATE public.meeting_slot_attendees
     SET booked_by = p_booked_by,
         booked_by_anterior = v_att.booked_by,
         booked_by_ajustado_por = v_actor,
         booked_by_ajustado_em = now()
   WHERE id = p_attendee_id;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
  VALUES (
    v_actor,
    'attendee_booked_by_changed',
    'meeting_slot_attendees',
    p_attendee_id,
    jsonb_build_object('booked_by', v_att.booked_by),
    jsonb_build_object('booked_by', p_booked_by, 'attendee_name', v_att.attendee_name, 'deal_id', v_att.deal_id)
  );

  RETURN jsonb_build_object('status', 'ok');
END;
$$;

CREATE OR REPLACE FUNCTION public.agendador_ajuste_info(p_attendee_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN a.booked_by_ajustado_em IS NULL THEN NULL
    ELSE jsonb_build_object(
      'em', a.booked_by_ajustado_em,
      'por_nome', coalesce(pa.full_name, pa.email, 'usuário'),
      'anterior_nome', coalesce(pb.full_name, pb.email)
    )
  END
    FROM public.meeting_slot_attendees a
    LEFT JOIN public.profiles pa ON pa.id = a.booked_by_ajustado_por
    LEFT JOIN public.profiles pb ON pb.id = a.booked_by_anterior
   WHERE a.id = p_attendee_id;
$$;

GRANT EXECUTE ON FUNCTION public.listar_agendadores_disponiveis() TO authenticated;
GRANT EXECUTE ON FUNCTION public.corrigir_agendador_reuniao(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agendador_ajuste_info(uuid) TO authenticated;