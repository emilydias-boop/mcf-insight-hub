-- 1) Reserva pode nascer sem grupo/cota (a Embracon só devolve depois).
ALTER TABLE public.consortium_cards ALTER COLUMN grupo DROP NOT NULL;
ALTER TABLE public.consortium_cards ALTER COLUMN cota DROP NOT NULL;

-- 2) Fila única = reserva. O status 'cadastrada' deixa de existir.
UPDATE public.consorcio_pending_registrations
   SET status = 'aguardando_abertura', cadastrada_at = NULL, cadastrada_by = NULL
 WHERE status = 'cadastrada';

ALTER TABLE public.consorcio_pending_registrations
  DROP CONSTRAINT IF EXISTS consorcio_pending_registrations_status_check;
ALTER TABLE public.consorcio_pending_registrations
  ADD CONSTRAINT consorcio_pending_registrations_status_check
  CHECK (status = ANY (ARRAY['aguardando_abertura'::text, 'cota_aberta'::text, 'vinculada'::text, 'declinada'::text]));