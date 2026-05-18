-- 1) Boas vindas envia sempre (sem horário comercial)
UPDATE public.automation_flows
SET respect_business_hours = false
WHERE id = 'c4957cc5-a5bd-4e34-abea-bf3b77170d7c';

-- 2) Libera a fila atual presa para 09:00 BRT
UPDATE public.automation_queue
SET scheduled_at = now()
WHERE status = 'pending' AND scheduled_at > now();

-- 3) Remove o trigger duplicado em crm_deals (causa do envio em dobro)
DROP TRIGGER IF EXISTS trg_automation_enqueue_on_deal ON public.crm_deals;