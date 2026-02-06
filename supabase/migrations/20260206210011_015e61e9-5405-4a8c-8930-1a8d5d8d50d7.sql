-- =====================================================
-- Sincronização Bidirecional: Pipeline GR ↔ Carteiras GR
-- =====================================================

-- 1. Criar carteira para Marceline (se não existir)
INSERT INTO gr_wallets (gr_user_id, bu, max_capacity, is_open)
SELECT '094a75c9-7e87-4886-be1a-1dba4297173f', 'credito', 700, true
WHERE NOT EXISTS (
  SELECT 1 FROM gr_wallets WHERE gr_user_id = '094a75c9-7e87-4886-be1a-1dba4297173f'
);

-- 2. Adicionar constraint UNIQUE em deal_id (para upsert funcionar)
-- Primeiro verificar se já existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'gr_wallet_entries_deal_id_unique'
  ) THEN
    ALTER TABLE gr_wallet_entries 
    ADD CONSTRAINT gr_wallet_entries_deal_id_unique UNIQUE (deal_id);
  END IF;
END $$;

-- 3. Função para sincronizar deals existentes com carteiras
CREATE OR REPLACE FUNCTION sync_crm_deals_to_gr_wallets()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  synced_count integer := 0;
  deal_row RECORD;
  v_wallet_id UUID;
BEGIN
  FOR deal_row IN 
    SELECT 
      d.id as deal_id,
      d.name,
      d.value,
      d.contact_id,
      d.owner_id,
      d.created_at,
      c.email as contact_email,
      c.phone as contact_phone,
      p.id as owner_profile_id
    FROM crm_deals d
    LEFT JOIN crm_contacts c ON c.id = d.contact_id
    LEFT JOIN profiles p ON LOWER(p.email) = LOWER(d.owner_id)
    WHERE d.origin_id = '016e7467-e105-4d9a-9ff5-ecfe5f915e0c'
      AND NOT EXISTS (
        SELECT 1 FROM gr_wallet_entries gwe WHERE gwe.deal_id = d.id
      )
  LOOP
    SELECT id INTO v_wallet_id
    FROM gr_wallets
    WHERE gr_user_id = deal_row.owner_profile_id;
    
    IF v_wallet_id IS NOT NULL THEN
      INSERT INTO gr_wallet_entries (
        wallet_id, deal_id, contact_id, customer_name, 
        customer_email, customer_phone, status, entry_source,
        product_purchased, purchase_value, entry_date
      ) VALUES (
        v_wallet_id, deal_row.deal_id, deal_row.contact_id,
        deal_row.name, deal_row.contact_email, deal_row.contact_phone,
        'ativo', 'crm_sync', NULL, deal_row.value, deal_row.created_at
      );
      synced_count := synced_count + 1;
    END IF;
  END LOOP;
  
  RETURN synced_count;
END;
$$;

-- 4. Trigger function para sincronização automática CRM → Carteira
CREATE OR REPLACE FUNCTION sync_deal_to_gr_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_owner_profile_id UUID;
  v_contact_email TEXT;
  v_contact_phone TEXT;
  v_old_wallet_id UUID;
BEGIN
  -- Apenas para pipeline GR (00 - GERENTES DE RELACIONAMENTO)
  IF NEW.origin_id != '016e7467-e105-4d9a-9ff5-ecfe5f915e0c' THEN
    RETURN NEW;
  END IF;
  
  -- Buscar profile do owner atual
  SELECT id INTO v_owner_profile_id
  FROM profiles WHERE LOWER(email) = LOWER(NEW.owner_id);
  
  -- Buscar carteira do GR
  SELECT id INTO v_wallet_id
  FROM gr_wallets WHERE gr_user_id = v_owner_profile_id;
  
  -- Buscar dados do contato
  SELECT email, phone INTO v_contact_email, v_contact_phone
  FROM crm_contacts WHERE id = NEW.contact_id;
  
  IF v_wallet_id IS NOT NULL THEN
    -- INSERT or UPDATE na carteira
    INSERT INTO gr_wallet_entries (
      wallet_id, deal_id, contact_id, customer_name,
      customer_email, customer_phone, status, entry_source,
      purchase_value, entry_date
    ) VALUES (
      v_wallet_id, NEW.id, NEW.contact_id, NEW.name,
      v_contact_email, v_contact_phone, 'ativo', 'crm_sync',
      NEW.value, COALESCE(NEW.created_at, NOW())
    )
    ON CONFLICT (deal_id) DO UPDATE SET
      wallet_id = EXCLUDED.wallet_id,
      customer_name = EXCLUDED.customer_name,
      customer_email = EXCLUDED.customer_email,
      customer_phone = EXCLUDED.customer_phone,
      purchase_value = EXCLUDED.purchase_value,
      updated_at = NOW();
    
    -- Se mudou de owner, registrar transferência
    IF TG_OP = 'UPDATE' AND OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
      -- Buscar carteira antiga
      SELECT gw.id INTO v_old_wallet_id
      FROM gr_wallets gw
      JOIN profiles p ON p.id = gw.gr_user_id
      WHERE LOWER(p.email) = LOWER(OLD.owner_id);
      
      IF v_old_wallet_id IS NOT NULL AND v_old_wallet_id != v_wallet_id THEN
        INSERT INTO gr_transfers_log (
          entry_id, from_wallet_id, to_wallet_id, reason, transferred_by
        )
        SELECT 
          gwe.id, v_old_wallet_id, v_wallet_id, 
          'Transferência automática via CRM', auth.uid()
        FROM gr_wallet_entries gwe
        WHERE gwe.deal_id = NEW.id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger (drop primeiro se existir)
DROP TRIGGER IF EXISTS trigger_sync_deal_to_gr ON crm_deals;
CREATE TRIGGER trigger_sync_deal_to_gr
AFTER INSERT OR UPDATE OF owner_id, stage_id, name, value, contact_id ON crm_deals
FOR EACH ROW
EXECUTE FUNCTION sync_deal_to_gr_wallet();

-- 5. Trigger function para sincronização reversa Carteira → CRM
CREATE OR REPLACE FUNCTION sync_gr_entry_to_deal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se mudou status e tem deal vinculado
  IF NEW.deal_id IS NOT NULL AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Atualizar timestamp do deal para indicar atividade
    UPDATE crm_deals
    SET updated_at = NOW()
    WHERE id = NEW.deal_id;
    
    -- Registrar atividade no deal
    INSERT INTO deal_activities (
      deal_id, activity_type, description, metadata
    ) VALUES (
      NEW.deal_id::text,
      'status_change',
      'Status alterado na carteira GR: ' || OLD.status || ' → ' || NEW.status,
      jsonb_build_object(
        'source', 'gr_wallet',
        'old_status', OLD.status,
        'new_status', NEW.status,
        'entry_id', NEW.id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger reverso (drop primeiro se existir)
DROP TRIGGER IF EXISTS trigger_sync_gr_to_deal ON gr_wallet_entries;
CREATE TRIGGER trigger_sync_gr_to_deal
AFTER UPDATE OF status ON gr_wallet_entries
FOR EACH ROW
EXECUTE FUNCTION sync_gr_entry_to_deal();

-- 6. Atualizar contadores das carteiras automaticamente
CREATE OR REPLACE FUNCTION update_gr_wallet_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE gr_wallets 
    SET current_count = current_count + 1, updated_at = NOW()
    WHERE id = NEW.wallet_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE gr_wallets 
    SET current_count = GREATEST(0, current_count - 1), updated_at = NOW()
    WHERE id = OLD.wallet_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.wallet_id IS DISTINCT FROM NEW.wallet_id THEN
    -- Transferência: decrementa origem, incrementa destino
    UPDATE gr_wallets 
    SET current_count = GREATEST(0, current_count - 1), updated_at = NOW()
    WHERE id = OLD.wallet_id;
    UPDATE gr_wallets 
    SET current_count = current_count + 1, updated_at = NOW()
    WHERE id = NEW.wallet_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Criar trigger para contagem (drop primeiro se existir)
DROP TRIGGER IF EXISTS trigger_update_gr_wallet_count ON gr_wallet_entries;
CREATE TRIGGER trigger_update_gr_wallet_count
AFTER INSERT OR DELETE OR UPDATE OF wallet_id ON gr_wallet_entries
FOR EACH ROW
EXECUTE FUNCTION update_gr_wallet_count();