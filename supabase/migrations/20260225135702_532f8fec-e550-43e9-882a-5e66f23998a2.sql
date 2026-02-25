
-- 1. meeting_slot_attendees.deal_id → ON DELETE CASCADE
ALTER TABLE meeting_slot_attendees
DROP CONSTRAINT IF EXISTS meeting_slot_attendees_deal_id_fkey;

ALTER TABLE meeting_slot_attendees
ADD CONSTRAINT meeting_slot_attendees_deal_id_fkey
FOREIGN KEY (deal_id) REFERENCES crm_deals(id) ON DELETE CASCADE;

-- 2. consorcio_pending_registrations.deal_id → ON DELETE CASCADE
ALTER TABLE consorcio_pending_registrations
DROP CONSTRAINT IF EXISTS consorcio_pending_registrations_deal_id_fkey;

ALTER TABLE consorcio_pending_registrations
ADD CONSTRAINT consorcio_pending_registrations_deal_id_fkey
FOREIGN KEY (deal_id) REFERENCES crm_deals(id) ON DELETE CASCADE;

-- 3. whatsapp_conversations.deal_id → ON DELETE SET NULL
ALTER TABLE whatsapp_conversations
DROP CONSTRAINT IF EXISTS whatsapp_conversations_deal_id_fkey;

ALTER TABLE whatsapp_conversations
ADD CONSTRAINT whatsapp_conversations_deal_id_fkey
FOREIGN KEY (deal_id) REFERENCES crm_deals(id) ON DELETE SET NULL;

-- 4. crm_deals.replicated_from_deal_id → ON DELETE SET NULL
ALTER TABLE crm_deals
DROP CONSTRAINT IF EXISTS crm_deals_replicated_from_deal_id_fkey;

ALTER TABLE crm_deals
ADD CONSTRAINT crm_deals_replicated_from_deal_id_fkey
FOREIGN KEY (replicated_from_deal_id) REFERENCES crm_deals(id) ON DELETE SET NULL;
