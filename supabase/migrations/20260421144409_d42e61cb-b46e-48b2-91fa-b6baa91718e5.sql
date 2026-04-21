
-- Backfill contract_paid_at usando sale_date da Hubla mais antiga vinculada
WITH first_sales AS (
  SELECT
    msa.id AS attendee_id,
    msa.contract_paid_at AS old_paid_at,
    MIN(ht.sale_date) AS correct_paid_at
  FROM public.meeting_slot_attendees msa
  JOIN public.hubla_transactions ht
    ON ht.linked_attendee_id = msa.id
   AND ht.sale_status = 'completed'
  WHERE msa.status IN ('contract_paid', 'refunded')
    AND msa.contract_paid_at IS NOT NULL
  GROUP BY msa.id, msa.contract_paid_at
)
UPDATE public.meeting_slot_attendees msa
SET contract_paid_at = fs.correct_paid_at,
    updated_at = now()
FROM first_sales fs
WHERE msa.id = fs.attendee_id
  AND ABS(EXTRACT(EPOCH FROM (fs.old_paid_at - fs.correct_paid_at))) > 3600;
