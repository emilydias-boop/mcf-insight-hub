
INSERT INTO consorcio_pending_registrations (proposal_id, deal_id, tipo_pessoa, status, created_by)
SELECT 
  p.id as proposal_id,
  p.deal_id,
  'pf' as tipo_pessoa,
  'aguardando_abertura' as status,
  p.created_by
FROM consorcio_proposals p
WHERE p.status = 'aceita' 
  AND p.consortium_card_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM consorcio_pending_registrations r WHERE r.proposal_id = p.id
  );
