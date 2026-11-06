ALTER TABLE public.hubla_transactions DROP CONSTRAINT hubla_transactions_linked_method_check;
ALTER TABLE public.hubla_transactions ADD CONSTRAINT hubla_transactions_linked_method_check
  CHECK (linked_method IS NULL OR linked_method = ANY (ARRAY['auto','manual','manual_r2','manual_r1','manual_r1_venda','manual_sugestao']));