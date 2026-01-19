-- Função que cria notificação para SDRs autorizados do Perpétuo X1 quando novo deal é inserido
CREATE OR REPLACE FUNCTION notify_perpetuo_x1_new_deal()
RETURNS TRIGGER AS $$
DECLARE
  origin_group_id UUID;
  origin_name TEXT;
  perpetuo_x1_group_id UUID := 'a6f3cbfc-0567-427f-a405-5a869aaa6010';
  caroline_user_id UUID := 'c7005c87-76fc-43a9-8bfa-e1b41f48a9b7';
  contact_name TEXT;
  deal_display_name TEXT;
BEGIN
  -- Buscar group_id e nome do origin do deal
  SELECT group_id, name INTO origin_group_id, origin_name
  FROM crm_origins
  WHERE id = NEW.origin_id;
  
  -- Só notificar se for do grupo Perpétuo X1
  IF origin_group_id = perpetuo_x1_group_id THEN
    -- Buscar nome do contato se existir
    IF NEW.contact_id IS NOT NULL THEN
      SELECT name INTO contact_name
      FROM crm_contacts
      WHERE id = NEW.contact_id;
    END IF;
    
    deal_display_name := COALESCE(NEW.name, contact_name, 'Novo Lead');
    
    -- Criar notificação in-app para Caroline
    INSERT INTO user_notifications (
      user_id,
      title,
      message,
      type,
      action_url,
      metadata
    ) VALUES (
      caroline_user_id,
      '🚨 Novo Lead no Perpétuo X1',
      'Lead: ' || deal_display_name,
      'action_required',
      '/crm/negocios?deal=' || NEW.id::TEXT,
      jsonb_build_object(
        'deal_id', NEW.id,
        'deal_name', deal_display_name,
        'origin_id', NEW.origin_id,
        'origin_name', origin_name,
        'contact_name', contact_name,
        'created_at', now()
      )
    );
    
    RAISE LOG '[notify_perpetuo_x1_new_deal] Notificação criada para Caroline - Deal: %', deal_display_name;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover trigger se existir
DROP TRIGGER IF EXISTS trigger_notify_perpetuo_x1_new_deal ON crm_deals;

-- Criar trigger após INSERT em crm_deals
CREATE TRIGGER trigger_notify_perpetuo_x1_new_deal
  AFTER INSERT ON crm_deals
  FOR EACH ROW
  EXECUTE FUNCTION notify_perpetuo_x1_new_deal();