-- Fase 2: CPF em meeting_slot_attendees + backfill

-- 1. Coluna
ALTER TABLE public.meeting_slot_attendees
ADD COLUMN IF NOT EXISTS cpf text;

-- 2. Índice parcial
CREATE INDEX IF NOT EXISTS idx_meeting_slot_attendees_cpf
ON public.meeting_slot_attendees (cpf)
WHERE cpf IS NOT NULL;

-- 3. Backfill via email do contato (crm_contacts)
WITH cpf_por_email AS (
  SELECT DISTINCT ON (LOWER(customer_email))
    LOWER(customer_email) AS email_lower,
    customer_document
  FROM public.hubla_transactions
  WHERE customer_document IS NOT NULL
    AND customer_email IS NOT NULL
  ORDER BY LOWER(customer_email), sale_date DESC NULLS LAST
)
UPDATE public.meeting_slot_attendees a
SET cpf = cpe.customer_document
FROM public.crm_contacts c
JOIN cpf_por_email cpe ON cpe.email_lower = LOWER(c.email)
WHERE a.contact_id = c.id
  AND a.cpf IS NULL
  AND c.email IS NOT NULL;

-- 4. Backfill adicional via telefone do attendee
WITH cpf_por_phone AS (
  SELECT DISTINCT ON (regexp_replace(customer_phone, '[^0-9]', '', 'g'))
    regexp_replace(customer_phone, '[^0-9]', '', 'g') AS phone_digits,
    customer_document
  FROM public.hubla_transactions
  WHERE customer_document IS NOT NULL
    AND customer_phone IS NOT NULL
    AND length(regexp_replace(customer_phone, '[^0-9]', '', 'g')) >= 10
  ORDER BY regexp_replace(customer_phone, '[^0-9]', '', 'g'), sale_date DESC NULLS LAST
)
UPDATE public.meeting_slot_attendees a
SET cpf = cpp.customer_document
FROM cpf_por_phone cpp
WHERE a.cpf IS NULL
  AND a.attendee_phone IS NOT NULL
  AND length(regexp_replace(a.attendee_phone, '[^0-9]', '', 'g')) >= 10
  AND regexp_replace(a.attendee_phone, '[^0-9]', '', 'g') = cpp.phone_digits;