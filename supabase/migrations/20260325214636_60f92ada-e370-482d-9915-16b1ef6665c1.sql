-- Triggers
DROP TRIGGER IF EXISTS trigger_sync_deal_to_gr ON crm_deals;
DROP TRIGGER IF EXISTS trigger_sync_gr_to_deal ON gr_wallet_entries;
DROP TRIGGER IF EXISTS trigger_update_gr_wallet_count ON gr_wallet_entries;

-- Functions
DROP FUNCTION IF EXISTS sync_deal_to_gr_wallet();
DROP FUNCTION IF EXISTS sync_gr_entry_to_deal();
DROP FUNCTION IF EXISTS update_gr_wallet_count();
DROP FUNCTION IF EXISTS assign_partner_to_gr(uuid,text,text,text,text,numeric,text,text,text);
DROP FUNCTION IF EXISTS sync_crm_deals_to_gr_wallets();

-- Tables (dependentes primeiro)
DROP TABLE IF EXISTS gr_transfers_log;
DROP TABLE IF EXISTS gr_actions;
DROP TABLE IF EXISTS gr_distribution_rules;
DROP TABLE IF EXISTS gr_wallet_entries;
DROP TABLE IF EXISTS gr_wallets;

-- Types
DROP TYPE IF EXISTS gr_entry_status;
DROP TYPE IF EXISTS gr_action_type;
DROP TYPE IF EXISTS gr_distribution_mode;

-- Atualizar merge_duplicate_contacts (remover referência a gr_wallet_entries)
CREATE OR REPLACE FUNCTION merge_duplicate_contacts(
  keep_id uuid, remove_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE crm_deals SET contact_id = keep_id WHERE contact_id = remove_id;
  UPDATE crm_interactions SET contact_id = keep_id WHERE contact_id = remove_id;
  DELETE FROM crm_contacts WHERE id = remove_id;
END;
$$;