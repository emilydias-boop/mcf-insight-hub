
-- Function to auto-update overdue installments and subscription status
CREATE OR REPLACE FUNCTION public.update_overdue_billing_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_installments INTEGER;
  updated_subs INTEGER;
BEGIN
  -- 1. Mark pending installments as overdue if past due date
  UPDATE billing_installments
  SET status = 'atrasado', updated_at = NOW()
  WHERE status = 'pendente'
    AND data_vencimento < CURRENT_DATE;
  
  GET DIAGNOSTICS updated_installments = ROW_COUNT;

  -- 2. Mark subscriptions as 'atrasada' if they have overdue installments
  UPDATE billing_subscriptions bs
  SET status = 'atrasada', updated_at = NOW()
  WHERE bs.status = 'em_dia'
    AND EXISTS (
      SELECT 1 FROM billing_installments bi
      WHERE bi.subscription_id = bs.id
        AND bi.status = 'atrasado'
    );
  
  GET DIAGNOSTICS updated_subs = ROW_COUNT;

  -- 3. Mark subscriptions as 'em_dia' if all overdue installments are resolved
  UPDATE billing_subscriptions bs
  SET status = 'em_dia', updated_at = NOW()
  WHERE bs.status = 'atrasada'
    AND NOT EXISTS (
      SELECT 1 FROM billing_installments bi
      WHERE bi.subscription_id = bs.id
        AND bi.status = 'atrasado'
    )
    AND bs.status_quitacao != 'quitado';

  RAISE NOTICE 'Updated % installments and % subscriptions', updated_installments, updated_subs;
END;
$$;

-- Run the function immediately to fix existing data
SELECT public.update_overdue_billing_status();
