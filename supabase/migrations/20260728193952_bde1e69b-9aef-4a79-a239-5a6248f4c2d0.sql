ALTER TABLE public.ar_titulos DROP CONSTRAINT IF EXISTS ar_titulos_status_chk;
ALTER TABLE public.ar_titulos ADD CONSTRAINT ar_titulos_status_chk
  CHECK (status = ANY (ARRAY['aberto','quitado','cancelado','reembolsado']));