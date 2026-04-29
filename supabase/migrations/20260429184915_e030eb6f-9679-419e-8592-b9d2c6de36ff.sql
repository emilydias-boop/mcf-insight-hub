
CREATE OR REPLACE FUNCTION public.get_pendentes_audit_incorporador(
  p_start timestamptz,
  p_end timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH pendentes AS (
    SELECT a.id AS attendee_id, a.deal_id, a.contact_id, a.status AS attendee_status,
      a.is_reschedule, a.booked_at, a.booked_by, a.attendee_name, a.attendee_phone,
      ms.scheduled_at, ms.closer_id
    FROM meeting_slot_attendees a
    JOIN meeting_slots ms ON ms.id = a.meeting_slot_id
    JOIN closers c ON c.id = ms.closer_id
    WHERE ms.meeting_type = 'r1' AND c.bu = 'incorporador' AND a.is_partner = false
      AND ms.scheduled_at >= p_start
      AND ms.scheduled_at <  p_end
      AND lower(coalesce(a.status,'')) NOT IN ('completed','realizada','show','attended','contract_paid','refunded','no_show','noshow','no-show')
  ),
  historico AS (
    SELECT a.deal_id,
      count(*) AS total_r1s,
      count(*) FILTER (WHERE lower(a.status) IN ('no_show','noshow','no-show')) AS total_no_shows,
      count(*) FILTER (WHERE lower(a.status) IN ('completed','realizada','show','attended','contract_paid','refunded')) AS total_realizadas,
      count(*) FILTER (WHERE lower(a.status)='rescheduled') AS total_remarcacoes,
      count(*) FILTER (WHERE lower(a.status) IN ('cancelled','canceled','cancelada')) AS total_canceladas
    FROM meeting_slot_attendees a
    JOIN meeting_slots ms2 ON ms2.id = a.meeting_slot_id
    WHERE ms2.meeting_type='r1' AND a.deal_id IN (SELECT deal_id FROM pendentes WHERE deal_id IS NOT NULL)
    GROUP BY a.deal_id
  )
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) FROM (
    SELECT 
      COALESCE(d.name, p.attendee_name, '') AS lead_nome,
      COALESCE(ct.name, p.attendee_name, '') AS contato_nome,
      COALESCE(ct.email, '') AS contato_email,
      COALESCE(ct.phone, p.attendee_phone, '') AS contato_telefone,
      COALESCE(o.name, '') AS pipeline,
      COALESCE(st.name, '') AS stage_atual,
      COALESCE(d.product_name, '') AS product_name,
      COALESCE(prof_booked.full_name, prof_booked.email, '') AS quem_agendou,
      COALESCE(d.original_sdr_email, d.owner_id, '') AS sdr_atribuido,
      COALESCE(cl.name, '') AS closer_r1_atual,
      to_char(p.scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') AS r1_agendada_para,
      COALESCE(p.attendee_status, '') AS status_r1_atual,
      CASE WHEN p.is_reschedule THEN 'Sim' ELSE 'Não' END AS eh_remarcacao,
      COALESCE(to_char(p.booked_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'), '') AS booked_at,
      CASE 
        WHEN lower(p.attendee_status) IN ('rescheduled','cancelled','canceled','cancelada','sem_sucesso') THEN 'Remanejado/Restituído'
        WHEN p.scheduled_at >= now() THEN 'Futuro'
        ELSE 'Vencido s/ desfecho'
      END AS classificacao,
      COALESCE(h.total_r1s, 0) AS total_r1s,
      COALESCE(h.total_realizadas, 0) AS total_realizadas,
      COALESCE(h.total_no_shows, 0) AS total_no_shows,
      COALESCE(h.total_remarcacoes, 0) AS total_remarcacoes,
      COALESCE(h.total_canceladas, 0) AS total_canceladas,
      p.deal_id::text AS deal_id,
      p.attendee_id::text AS attendee_id
    FROM pendentes p
    LEFT JOIN crm_deals d ON d.id = p.deal_id
    LEFT JOIN crm_contacts ct ON ct.id = p.contact_id
    LEFT JOIN crm_origins o ON o.id = d.origin_id
    LEFT JOIN local_pipeline_stages st ON st.id = d.stage_id
    LEFT JOIN closers cl ON cl.id = p.closer_id
    LEFT JOIN profiles prof_booked ON prof_booked.id = p.booked_by
    LEFT JOIN historico h ON h.deal_id = p.deal_id
    ORDER BY 
      CASE 
        WHEN lower(p.attendee_status) IN ('rescheduled','cancelled','canceled','cancelada','sem_sucesso') THEN 1
        WHEN p.scheduled_at < now() THEN 2
        ELSE 3
      END,
      p.scheduled_at ASC
  ) t;
$$;

REVOKE ALL ON FUNCTION public.get_pendentes_audit_incorporador(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pendentes_audit_incorporador(timestamptz, timestamptz) TO authenticated, service_role;
