DO $$
DECLARE
  r RECORD;
  moved INT := 0;
BEGIN
  FOR r IN
    WITH stuck AS (
      SELECT DISTINCT d.id AS deal_id, d.origin_id, d.stage_id, cs.stage_order AS cur_order
      FROM meeting_slot_attendees a
      JOIN meeting_slots ms ON ms.id = a.meeting_slot_id
      JOIN crm_deals d ON d.id = a.deal_id
      LEFT JOIN crm_stages cs ON cs.id = d.stage_id
      WHERE a.status = 'completed'
        AND ms.scheduled_at >= now() - interval '30 days'
        AND COALESCE(cs.stage_name,'') !~* 'realizada|contrato|venda'
    )
    SELECT s.deal_id, s.stage_id, s.cur_order, t.id AS target_id, t.stage_order AS target_order
    FROM stuck s
    JOIN crm_stages t ON t.origin_id = s.origin_id
      AND (t.stage_name ILIKE 'R1 Realizada'
        OR t.stage_name ILIKE 'Reunião 01 Realizada'
        OR t.stage_name ILIKE 'Reunião 1 Realizada'
        OR t.stage_name ILIKE 'REUNIÃO 1 REALIZADA')
    WHERE t.id IS DISTINCT FROM s.stage_id
      AND (s.cur_order IS NULL OR t.stage_order IS NULL OR t.stage_order >= s.cur_order)
  LOOP
    UPDATE crm_deals SET stage_id = r.target_id, updated_at = now() WHERE id = r.deal_id;

    INSERT INTO deal_activities (deal_id, activity_type, description, from_stage, to_stage, metadata)
    VALUES (
      r.deal_id,
      'stage_change',
      'Backfill: reunião marcada como Realizada na Agenda sem sincronização de estágio',
      r.stage_id,
      r.target_id,
      jsonb_build_object('via','agenda_sync_backfill','status','completed','meetingType','r1')
    );

    moved := moved + 1;
  END LOOP;

  RAISE NOTICE 'Backfill: % negócios movidos', moved;
END $$;