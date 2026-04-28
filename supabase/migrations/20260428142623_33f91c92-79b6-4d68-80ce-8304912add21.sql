INSERT INTO public.late_status_change_attempts (
  attendee_id, slot_id, meeting_scheduled_at, ano_mes,
  old_status, new_status, days_after_meeting,
  was_blocked, block_reason,
  attempted_by, attempted_by_email, attempted_by_role,
  attendee_name, closer_name, created_at
)
SELECT
  al.record_id::uuid AS attendee_id,
  msa.meeting_slot_id AS slot_id,
  ms.scheduled_at AS meeting_scheduled_at,
  to_char(ms.scheduled_at, 'YYYY-MM') AS ano_mes,
  (al.old_data->>'status') AS old_status,
  (al.new_data->>'status') AS new_status,
  GREATEST(0, (al.created_at::date - ms.scheduled_at::date))::int AS days_after_meeting,
  COALESCE(msl.is_active, false) AS was_blocked,
  CASE WHEN COALESCE(msl.is_active, false) THEN 'Mês fechado (backfill histórico)' ELSE NULL END AS block_reason,
  al.user_id AS attempted_by,
  p.email AS attempted_by_email,
  COALESCE(
    CASE
      WHEN LOWER(COALESCE(e.cargo, '')) LIKE '%sdr%' THEN 'sdr'
      WHEN LOWER(COALESCE(e.cargo, '')) LIKE '%closer%' THEN 'closer'
      WHEN LOWER(COALESCE(e.cargo, '')) LIKE '%coorden%' THEN 'coordenador'
      WHEN LOWER(COALESCE(e.cargo, '')) LIKE '%gestor%' OR LOWER(COALESCE(e.cargo, '')) LIKE '%manager%' THEN 'manager'
      WHEN LOWER(COALESCE(e.cargo, '')) LIKE '%admin%' THEN 'admin'
      ELSE 'outro'
    END,
    'outro'
  ) AS attempted_by_role,
  msa.attendee_name,
  c.name AS closer_name,
  al.created_at
FROM public.audit_logs al
JOIN public.meeting_slot_attendees msa ON msa.id = al.record_id::uuid
JOIN public.meeting_slots ms ON ms.id = msa.meeting_slot_id
LEFT JOIN public.closers c ON c.id = ms.closer_id
LEFT JOIN public.profiles p ON p.id = al.user_id
LEFT JOIN public.employees e ON e.profile_id = al.user_id
LEFT JOIN public.meeting_status_locks msl
  ON msl.ano_mes = to_char(ms.scheduled_at, 'YYYY-MM')
  AND msl.is_active = true
WHERE al.table_name = 'meeting_slot_attendees'
  AND al.action = 'UPDATE'
  AND al.old_data IS NOT NULL
  AND al.new_data IS NOT NULL
  AND (al.old_data->>'status') IS DISTINCT FROM (al.new_data->>'status')
  AND (al.created_at::date - ms.scheduled_at::date) >= 1
  AND NOT EXISTS (
    SELECT 1 FROM public.late_status_change_attempts lsca
    WHERE lsca.attendee_id = al.record_id::uuid
      AND lsca.created_at = al.created_at
      AND lsca.old_status = (al.old_data->>'status')
      AND lsca.new_status = (al.new_data->>'status')
  );