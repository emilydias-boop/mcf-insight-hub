## Ação one-off

Cancelar o envio `c409595e...` na tabela `mcf_pay_dispatch_logs` para que o retry queue pare de tentá-lo.

### Passos

1. Confirmar o registro exato via `SELECT id, status, attempt, next_retry_at, deal_id, source, created_at FROM public.mcf_pay_dispatch_logs WHERE id::text LIKE 'c409595e%'` para validar prefixo único.
2. Rodar UPDATE:
   ```sql
   UPDATE public.mcf_pay_dispatch_logs
   SET status = 'cancelled',
       next_retry_at = NULL,
       error_message = COALESCE(error_message, '') || ' | cancelado manualmente'
   WHERE id::text LIKE 'c409595e%';
   ```

Sem alteração de código ou UI.
