
-- Delete the duplicate deal directly (Contrato Pago from Feb 21)
DELETE FROM crm_deals WHERE id = 'd7ad3ea4-ada7-4533-910d-43274c20876c';

-- Delete 3 duplicate contacts (keeping af97f5e6 as primary)
DELETE FROM crm_contacts WHERE id IN ('58daf50c-45e4-4567-8025-79099c84c2ec', '0412cb88-7be3-4bf3-98a7-cbcd4abfc2b9', '72139f45-73e9-4bce-b394-962eed30dd20');
