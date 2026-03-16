
-- Corrigir contract_paid_at de todos os attendees vinculados a transações Hubla
-- onde o valor difere da sale_date real por mais de 1 hora
UPDATE meeting_slot_attendees msa
SET contract_paid_at = ht.sale_date
FROM hubla_transactions ht
WHERE ht.linked_attendee_id = msa.id
  AND msa.status = 'contract_paid'
  AND msa.contract_paid_at IS NOT NULL
  AND ht.sale_date IS NOT NULL
  AND ABS(EXTRACT(EPOCH FROM (msa.contract_paid_at::timestamp - ht.sale_date::timestamp))) > 3600;
