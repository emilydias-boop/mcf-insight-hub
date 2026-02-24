

## Correcao: Socios nao devem ser marcados como contract_paid

### Problema

Quando um contrato e pago, o sistema busca attendees recentes por email/telefone e marca como `contract_paid`. Porem, **nao filtra socios** (`is_partner = true`). Isso causa:

- Socios sendo marcados como `contract_paid` indevidamente (encontrados 3 casos: Eduardo Benicio, Levi, Luciano)
- Inflacao potencial de metricas de contratos pagos

### Correcao de dados

Reverter os 3 socios incorretamente marcados como `contract_paid` para o status `scheduled`:

| Attendee | ID |
|---|---|
| Eduardo Benicio | `ab791ce3-e728-4138-acd4-886eae1d3060` |
| Levi | `65ed77d1-33ad-4342-9b97-8f32204d9104` |
| Luciano | `968ee07c-bc80-4099-adf6-fc69c44d7877` |

Para cada um: `status = 'scheduled'`, `contract_paid_at = NULL`.

### Correcao de logica (5 pontos de entrada)

Adicionar filtro `is_partner = false` (ou `is_partner IS NULL`) em todos os pontos que marcam attendees como `contract_paid`:

1. **`supabase/functions/hubla-webhook-handler/index.ts`** (~linha 773)
   - Na query de attendees R1, adicionar `.eq('is_partner', false)` para excluir socios da busca de match

2. **`supabase/functions/webhook-make-contrato/index.ts`** (~linha 79)
   - Mesma correcao: adicionar `.eq('is_partner', false)` na query de attendees

3. **`supabase/functions/reprocess-contract-payments/index.ts`** (~linha 107)
   - Adicionar `.eq('is_partner', false)` na query de attendees

4. **`src/hooks/useAgendaData.ts`** (funcao `useMarkContractPaid`, ~linha 703)
   - Antes de marcar como `contract_paid`, verificar se o attendee nao e socio. Se `is_partner = true`, exibir erro e bloquear

5. **`src/hooks/useLinkContractToAttendee.ts`** (~linha 47)
   - Antes de marcar como `contract_paid`, verificar se o attendee nao e socio. Se `is_partner = true`, exibir erro e bloquear

### Resumo tecnico

A mudanca principal e adicionar `.eq('is_partner', false)` nas queries dos 3 webhooks/edge functions para que socios nunca sejam encontrados como candidatos a match. Nos 2 hooks do frontend, adicionar uma verificacao antes de atualizar o status.
