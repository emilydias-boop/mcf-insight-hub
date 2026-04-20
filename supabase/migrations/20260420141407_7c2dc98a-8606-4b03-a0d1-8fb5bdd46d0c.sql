-- Fix broken outbound webhook trigger on hubla_transactions
-- The previous migration replaced the trigger function with one that calls
-- enqueue_outbound_sale_webhook(uuid, text), which does not exist.
-- This was aborting all inserts on hubla_transactions.

DROP TRIGGER IF EXISTS trg_outbound_sale_webhook ON public.hubla_transactions;
DROP FUNCTION IF EXISTS public.outbound_sale_webhook_trigger();

-- Recreate trigger using the original parameterless function that already
-- handles event filtering and enqueues to outbound_webhook_queue
CREATE TRIGGER trg_outbound_sale_webhook
AFTER INSERT OR UPDATE ON public.hubla_transactions
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_outbound_sale_webhook();