
-- Distribute 18 unassigned deals from Inside Sales to 8 SDRs (round-robin)
DO $$
DECLARE
  v_origin_id uuid := 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c';
  v_deal record;
  v_sdr record;
  v_sdrs text[][] := ARRAY[
    ARRAY['carol.correa@minhacasafinanciada.com', 'Caroline Aparecida Corrêa', 'c7005c87-76fc-43a9-8bfa-e1b41f48a9b7'],
    ARRAY['caroline.souza@minhacasafinanciada.com', 'Caroline Souza', '4c947a4c-80c1-4439-bd31-2b38e3a3f1d0'],
    ARRAY['leticia.nunes@minhacasafinanciada.com', 'Leticia Nunes dos Santos', 'c1ede6ed-e3ae-465f-91dd-a708200a85fc'],
    ARRAY['mayara.souza@minhacasafinanciada.com', 'Mayara Souza', '39162395-dec0-40b2-94ed-3a7443013e44'],
    ARRAY['julia.caroline@minhacasafinanciada.com', 'Julia Caroline', '794a2257-422c-4b38-9014-3135d9e26361'],
    ARRAY['marcio.dantas@minhacasafinanciada.com', 'Marcio Dantas', '98c03c9a-5387-4322-8f22-3e3fb5d6da87'],
    ARRAY['robert.gusmao@minhacasafinanciada.com', 'Robert Roger Santos Gusmão', 'f12d079b-8c99-49b4-9233-4705886e079b'],
    ARRAY['alex.dias@minhacasafinanciada.com', 'Alex Dias', '16c5d025-9cda-45fa-ae2f-7170bfb8dee8']
  ];
  v_idx int := 0;
  v_sdr_email text;
  v_sdr_name text;
  v_sdr_profile_id uuid;
  v_counts int[] := ARRAY[0,0,0,0,0,0,0,0];
BEGIN
  -- Loop through unassigned deals
  FOR v_deal IN
    SELECT id, name FROM crm_deals
    WHERE origin_id = v_origin_id
      AND (owner_id IS NULL OR owner_id = '')
      AND created_at >= '2026-04-06'
    ORDER BY created_at ASC
  LOOP
    v_sdr_email := v_sdrs[v_idx + 1][1];
    v_sdr_name := v_sdrs[v_idx + 1][2];
    v_sdr_profile_id := v_sdrs[v_idx + 1][3]::uuid;

    -- Update deal owner
    UPDATE crm_deals
    SET owner_id = v_sdr_email,
        owner_profile_id = v_sdr_profile_id,
        updated_at = now()
    WHERE id = v_deal.id;

    -- Log activity
    INSERT INTO deal_activities (deal_id, activity_type, description, metadata)
    VALUES (
      v_deal.id,
      'owner_change',
      'Lead atribuído automaticamente para ' || v_sdr_name || ' (distribuição backfill)',
      jsonb_build_object(
        'new_owner', v_sdr_email,
        'new_owner_name', v_sdr_name,
        'distribution_type', 'backfill_round_robin',
        'assigned_at', now()::text
      )
    );

    v_counts[v_idx + 1] := v_counts[v_idx + 1] + 1;
    v_idx := (v_idx + 1) % 8;
  END LOOP;

  -- Update distribution counters
  FOR i IN 1..8 LOOP
    UPDATE lead_distribution_config
    SET current_count = current_count + v_counts[i],
        updated_at = now()
    WHERE origin_id = v_origin_id
      AND user_email = v_sdrs[i][1];
  END LOOP;

  RAISE NOTICE 'Distributed % deals. Counts: Carol=%, Caroline=%, Leticia=%, Mayara=%, Julia=%, Marcio=%, Robert=%, Alex=%',
    v_counts[1]+v_counts[2]+v_counts[3]+v_counts[4]+v_counts[5]+v_counts[6]+v_counts[7]+v_counts[8],
    v_counts[1], v_counts[2], v_counts[3], v_counts[4], v_counts[5], v_counts[6], v_counts[7], v_counts[8];
END $$;
