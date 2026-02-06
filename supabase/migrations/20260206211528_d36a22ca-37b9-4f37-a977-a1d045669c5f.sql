-- Recalcular current_count para refletir contagem real de entries
UPDATE gr_wallets gw
SET current_count = (
  SELECT COUNT(*) 
  FROM gr_wallet_entries gwe 
  WHERE gwe.wallet_id = gw.id
);