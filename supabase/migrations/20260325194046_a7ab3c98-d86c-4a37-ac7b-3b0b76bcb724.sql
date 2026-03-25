
CREATE OR REPLACE FUNCTION merge_consorcio_duplicates()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_consorcio_origins uuid[] := ARRAY[
    '4e2b810a-6782-4ce9-9c0d-10d04c018636'::uuid,
    '7d7b1cb5-2a44-4552-9eff-c3b798646b78'::uuid
  ];
  v_primary_id uuid;
  v_dup_id uuid;
  v_email text;
  v_phone_suffix text;
  v_primary_deal uuid;
  v_sec_deal uuid;
  v_existing_deal uuid;
  v_email_merged int := 0;
  v_email_contacts_deleted int := 0;
  v_phone_merged int := 0;
  v_phone_contacts_deleted int := 0;
  v_deals_consolidated int := 0;
  rec record;
  dup record;
  deal_rec record;
BEGIN
  -- ========== ETAPA 1: MERGE POR EMAIL ==========
  FOR rec IN
    SELECT LOWER(c.email) as grp_email
    FROM crm_contacts c
    WHERE c.email IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM crm_deals d 
        WHERE d.contact_id = c.id AND d.origin_id = ANY(v_consorcio_origins)
      )
    GROUP BY LOWER(c.email)
    HAVING COUNT(*) > 1
  LOOP
    v_email := rec.grp_email;
    
    SELECT c.id INTO v_primary_id
    FROM crm_contacts c
    LEFT JOIN crm_deals d ON d.contact_id = c.id
    LEFT JOIN crm_stages s ON s.id = d.stage_id
    WHERE LOWER(c.email) = v_email
    GROUP BY c.id, c.created_at
    ORDER BY MAX(COALESCE(s.stage_order, -1)) DESC, COUNT(d.id) DESC, c.created_at ASC
    LIMIT 1;
    
    FOR dup IN
      SELECT c.id as dup_id, c.phone as dup_phone
      FROM crm_contacts c
      WHERE LOWER(c.email) = v_email AND c.id != v_primary_id
    LOOP
      v_dup_id := dup.dup_id;
      
      UPDATE crm_contacts SET phone = dup.dup_phone 
      WHERE id = v_primary_id AND phone IS NULL AND dup.dup_phone IS NOT NULL;
      
      -- Consolidar deals conflitantes ANTES de transferir contact_id
      FOR deal_rec IN
        SELECT d.id as dup_deal_id, d.origin_id as dup_origin_id
        FROM crm_deals d
        WHERE d.contact_id = v_dup_id AND d.origin_id IS NOT NULL
      LOOP
        SELECT d2.id INTO v_existing_deal
        FROM crm_deals d2
        WHERE d2.contact_id = v_primary_id AND d2.origin_id = deal_rec.dup_origin_id
        LIMIT 1;
        
        IF v_existing_deal IS NOT NULL THEN
          -- Conflito: consolidar deal duplicado no existente
          -- Escolher o mais avançado como primário
          SELECT d.id INTO v_primary_deal
          FROM crm_deals d
          LEFT JOIN crm_stages s ON s.id = d.stage_id
          WHERE d.id IN (v_existing_deal, deal_rec.dup_deal_id)
          ORDER BY COALESCE(s.stage_order, -1) DESC, d.created_at ASC
          LIMIT 1;
          
          v_sec_deal := CASE WHEN v_primary_deal = v_existing_deal THEN deal_rec.dup_deal_id ELSE v_existing_deal END;
          
          UPDATE meeting_slots SET deal_id = v_primary_deal WHERE deal_id = v_sec_deal;
          UPDATE meeting_slot_attendees SET deal_id = v_primary_deal WHERE deal_id = v_sec_deal;
          UPDATE calls SET deal_id = v_primary_deal WHERE deal_id = v_sec_deal;
          UPDATE deal_activities SET deal_id = v_primary_deal::text WHERE deal_id = v_sec_deal::text;
          UPDATE deal_tasks SET deal_id = v_primary_deal WHERE deal_id = v_sec_deal;
          UPDATE automation_queue SET deal_id = v_primary_deal WHERE deal_id = v_sec_deal;
          UPDATE automation_logs SET deal_id = v_primary_deal WHERE deal_id = v_sec_deal;
          UPDATE billing_subscriptions SET deal_id = v_primary_deal WHERE deal_id = v_sec_deal;
          BEGIN EXECUTE 'UPDATE consorcio_pending_registrations SET deal_id = $1 WHERE deal_id = $2' USING v_primary_deal, v_sec_deal; EXCEPTION WHEN undefined_table THEN NULL; END;
          BEGIN EXECUTE 'UPDATE consorcio_proposals SET deal_id = $1 WHERE deal_id = $2' USING v_primary_deal, v_sec_deal; EXCEPTION WHEN undefined_table THEN NULL; END;
          BEGIN EXECUTE 'UPDATE deal_produtos_adquiridos SET deal_id = $1 WHERE deal_id = $2' USING v_primary_deal, v_sec_deal; EXCEPTION WHEN undefined_table THEN NULL; END;
          
          DELETE FROM crm_deals WHERE id = v_sec_deal;
          v_deals_consolidated := v_deals_consolidated + 1;
          
          -- Se o deal que sobrou era do duplicado, atualizar contact_id
          IF v_primary_deal = deal_rec.dup_deal_id THEN
            UPDATE crm_deals SET contact_id = v_primary_id WHERE id = v_primary_deal;
          END IF;
        ELSE
          -- Sem conflito: transferir normalmente
          UPDATE crm_deals SET contact_id = v_primary_id WHERE id = deal_rec.dup_deal_id;
        END IF;
      END LOOP;
      
      -- Transferir FKs restantes (NO ACTION primeiro)
      UPDATE meeting_slot_attendees SET contact_id = v_primary_id WHERE contact_id = v_dup_id;
      UPDATE whatsapp_conversations SET contact_id = v_primary_id WHERE contact_id = v_dup_id;
      UPDATE crm_deals SET contact_id = v_primary_id WHERE contact_id = v_dup_id;
      UPDATE calls SET contact_id = v_primary_id WHERE contact_id = v_dup_id;
      UPDATE meeting_slots SET contact_id = v_primary_id WHERE contact_id = v_dup_id;
      UPDATE lead_profiles SET contact_id = v_primary_id WHERE contact_id = v_dup_id;
      UPDATE automation_blacklist SET contact_id = v_primary_id WHERE contact_id = v_dup_id;
      UPDATE automation_queue SET contact_id = v_primary_id WHERE contact_id = v_dup_id;
      UPDATE automation_logs SET contact_id = v_primary_id WHERE contact_id = v_dup_id;
      UPDATE billing_subscriptions SET contact_id = v_primary_id WHERE contact_id = v_dup_id;
      UPDATE deal_tasks SET contact_id = v_primary_id WHERE contact_id = v_dup_id;
      UPDATE encaixe_queue SET contact_id = v_primary_id WHERE contact_id = v_dup_id;
      UPDATE gr_wallet_entries SET contact_id = v_primary_id WHERE contact_id = v_dup_id;
      UPDATE partner_returns SET contact_id = v_primary_id WHERE contact_id = v_dup_id;
      
      DELETE FROM crm_contacts WHERE id = v_dup_id;
      v_email_contacts_deleted := v_email_contacts_deleted + 1;
    END LOOP;
    
    v_email_merged := v_email_merged + 1;
  END LOOP;

  -- ========== ETAPA 2: MERGE POR TELEFONE ==========
  FOR rec IN
    SELECT RIGHT(REGEXP_REPLACE(c.phone, '\D', '', 'g'), 9) as grp_suffix
    FROM crm_contacts c
    WHERE c.phone IS NOT NULL
      AND LENGTH(REGEXP_REPLACE(c.phone, '\D', '', 'g')) >= 9
      AND EXISTS (
        SELECT 1 FROM crm_deals d 
        WHERE d.contact_id = c.id AND d.origin_id = ANY(v_consorcio_origins)
      )
    GROUP BY RIGHT(REGEXP_REPLACE(c.phone, '\D', '', 'g'), 9)
    HAVING COUNT(*) > 1
  LOOP
    v_phone_suffix := rec.grp_suffix;
    
    SELECT c.id INTO v_primary_id
    FROM crm_contacts c
    LEFT JOIN crm_deals d ON d.contact_id = c.id
    LEFT JOIN crm_stages s ON s.id = d.stage_id
    WHERE RIGHT(REGEXP_REPLACE(c.phone, '\D', '', 'g'), 9) = v_phone_suffix
      AND LENGTH(REGEXP_REPLACE(c.phone, '\D', '', 'g')) >= 9
    GROUP BY c.id, c.created_at
    ORDER BY MAX(COALESCE(s.stage_order, -1)) DESC, COUNT(d.id) DESC, c.created_at ASC
    LIMIT 1;
    
    FOR dup IN
      SELECT c.id as dup_id, c.email as dup_email
      FROM crm_contacts c
      WHERE RIGHT(REGEXP_REPLACE(c.phone, '\D', '', 'g'), 9) = v_phone_suffix
        AND LENGTH(REGEXP_REPLACE(c.phone, '\D', '', 'g')) >= 9
        AND c.id != v_primary_id
    LOOP
      v_dup_id := dup.dup_id;
      
      UPDATE crm_contacts SET email = dup.dup_email 
      WHERE id = v_primary_id AND email IS NULL AND dup.dup_email IS NOT NULL;
      
      -- Consolidar deals conflitantes
      FOR deal_rec IN
        SELECT d.id as dup_deal_id, d.origin_id as dup_origin_id
        FROM crm_deals d
        WHERE d.contact_id = v_dup_id AND d.origin_id IS NOT NULL
      LOOP
        SELECT d2.id INTO v_existing_deal
        FROM crm_deals d2
        WHERE d2.contact_id = v_primary_id AND d2.origin_id = deal_rec.dup_origin_id
        LIMIT 1;
        
        IF v_existing_deal IS NOT NULL THEN
          SELECT d.id INTO v_primary_deal
          FROM crm_deals d
          LEFT JOIN crm_stages s ON s.id = d.stage_id
          WHERE d.id IN (v_existing_deal, deal_rec.dup_deal_id)
          ORDER BY COALESCE(s.stage_order, -1) DESC, d.created_at ASC
          LIMIT 1;
          
          v_sec_deal := CASE WHEN v_primary_deal = v_existing_deal THEN deal_rec.dup_deal_id ELSE v_existing_deal END;
          
          UPDATE meeting_slots SET deal_id = v_primary_deal WHERE deal_id = v_sec_deal;
          UPDATE meeting_slot_attendees SET deal_id = v_primary_deal WHERE deal_id = v_sec_deal;
          UPDATE calls SET deal_id = v_primary_deal WHERE deal_id = v_sec_deal;
          UPDATE deal_activities SET deal_id = v_primary_deal::text WHERE deal_id = v_sec_deal::text;
          UPDATE deal_tasks SET deal_id = v_primary_deal WHERE deal_id = v_sec_deal;
          UPDATE automation_queue SET deal_id = v_primary_deal WHERE deal_id = v_sec_deal;
          UPDATE automation_logs SET deal_id = v_primary_deal WHERE deal_id = v_sec_deal;
          UPDATE billing_subscriptions SET deal_id = v_primary_deal WHERE deal_id = v_sec_deal;
          BEGIN EXECUTE 'UPDATE consorcio_pending_registrations SET deal_id = $1 WHERE deal_id = $2' USING v_primary_deal, v_sec_deal; EXCEPTION WHEN undefined_table THEN NULL; END;
          BEGIN EXECUTE 'UPDATE consorcio_proposals SET deal_id = $1 WHERE deal_id = $2' USING v_primary_deal, v_sec_deal; EXCEPTION WHEN undefined_table THEN NULL; END;
          BEGIN EXECUTE 'UPDATE deal_produtos_adquiridos SET deal_id = $1 WHERE deal_id = $2' USING v_primary_deal, v_sec_deal; EXCEPTION WHEN undefined_table THEN NULL; END;
          
          DELETE FROM crm_deals WHERE id = v_sec_deal;
          v_deals_consolidated := v_deals_consolidated + 1;
          
          IF v_primary_deal = deal_rec.dup_deal_id THEN
            UPDATE crm_deals SET contact_id = v_primary_id WHERE id = v_primary_deal;
          END IF;
        ELSE
          UPDATE crm_deals SET contact_id = v_primary_id WHERE id = deal_rec.dup_deal_id;
        END IF;
      END LOOP;
      
      -- Transferir FKs restantes
      UPDATE meeting_slot_attendees SET contact_id = v_primary_id WHERE contact_id = v_dup_id;
      UPDATE whatsapp_conversations SET contact_id = v_primary_id WHERE contact_id = v_dup_id;
      UPDATE crm_deals SET contact_id = v_primary_id WHERE contact_id = v_dup_id;
      UPDATE calls SET contact_id = v_primary_id WHERE contact_id = v_dup_id;
      UPDATE meeting_slots SET contact_id = v_primary_id WHERE contact_id = v_dup_id;
      UPDATE lead_profiles SET contact_id = v_primary_id WHERE contact_id = v_dup_id;
      UPDATE automation_blacklist SET contact_id = v_primary_id WHERE contact_id = v_dup_id;
      UPDATE automation_queue SET contact_id = v_primary_id WHERE contact_id = v_dup_id;
      UPDATE automation_logs SET contact_id = v_primary_id WHERE contact_id = v_dup_id;
      UPDATE billing_subscriptions SET contact_id = v_primary_id WHERE contact_id = v_dup_id;
      UPDATE deal_tasks SET contact_id = v_primary_id WHERE contact_id = v_dup_id;
      UPDATE encaixe_queue SET contact_id = v_primary_id WHERE contact_id = v_dup_id;
      UPDATE gr_wallet_entries SET contact_id = v_primary_id WHERE contact_id = v_dup_id;
      UPDATE partner_returns SET contact_id = v_primary_id WHERE contact_id = v_dup_id;
      
      DELETE FROM crm_contacts WHERE id = v_dup_id;
      v_phone_contacts_deleted := v_phone_contacts_deleted + 1;
    END LOOP;
    
    v_phone_merged := v_phone_merged + 1;
  END LOOP;

  -- ========== ETAPA 3: CONSOLIDAR DEALS RESTANTES ==========
  FOR rec IN
    SELECT d.contact_id, d.origin_id
    FROM crm_deals d
    WHERE d.contact_id IS NOT NULL
      AND d.origin_id = ANY(v_consorcio_origins)
    GROUP BY d.contact_id, d.origin_id
    HAVING COUNT(*) > 1
  LOOP
    SELECT d.id INTO v_primary_deal
    FROM crm_deals d
    LEFT JOIN crm_stages s ON s.id = d.stage_id
    WHERE d.contact_id = rec.contact_id AND d.origin_id = rec.origin_id
    ORDER BY COALESCE(s.stage_order, -1) DESC, d.created_at ASC
    LIMIT 1;
    
    FOR dup IN
      SELECT d.id as sec_id
      FROM crm_deals d
      WHERE d.contact_id = rec.contact_id 
        AND d.origin_id = rec.origin_id 
        AND d.id != v_primary_deal
    LOOP
      v_sec_deal := dup.sec_id;
      
      UPDATE meeting_slots SET deal_id = v_primary_deal WHERE deal_id = v_sec_deal;
      UPDATE meeting_slot_attendees SET deal_id = v_primary_deal WHERE deal_id = v_sec_deal;
      UPDATE calls SET deal_id = v_primary_deal WHERE deal_id = v_sec_deal;
      UPDATE deal_activities SET deal_id = v_primary_deal::text WHERE deal_id = v_sec_deal::text;
      UPDATE deal_tasks SET deal_id = v_primary_deal WHERE deal_id = v_sec_deal;
      UPDATE automation_queue SET deal_id = v_primary_deal WHERE deal_id = v_sec_deal;
      UPDATE automation_logs SET deal_id = v_primary_deal WHERE deal_id = v_sec_deal;
      UPDATE billing_subscriptions SET deal_id = v_primary_deal WHERE deal_id = v_sec_deal;
      BEGIN EXECUTE 'UPDATE consorcio_pending_registrations SET deal_id = $1 WHERE deal_id = $2' USING v_primary_deal, v_sec_deal; EXCEPTION WHEN undefined_table THEN NULL; END;
      BEGIN EXECUTE 'UPDATE consorcio_proposals SET deal_id = $1 WHERE deal_id = $2' USING v_primary_deal, v_sec_deal; EXCEPTION WHEN undefined_table THEN NULL; END;
      BEGIN EXECUTE 'UPDATE deal_produtos_adquiridos SET deal_id = $1 WHERE deal_id = $2' USING v_primary_deal, v_sec_deal; EXCEPTION WHEN undefined_table THEN NULL; END;
      
      DELETE FROM crm_deals WHERE id = v_sec_deal;
      v_deals_consolidated := v_deals_consolidated + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'email_groups_merged', v_email_merged,
    'email_contacts_deleted', v_email_contacts_deleted,
    'phone_groups_merged', v_phone_merged,
    'phone_contacts_deleted', v_phone_contacts_deleted,
    'deals_consolidated', v_deals_consolidated
  );
END;
$$;

SELECT merge_consorcio_duplicates();

DROP FUNCTION merge_consorcio_duplicates();
