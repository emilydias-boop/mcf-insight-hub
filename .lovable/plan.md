

## Plano: Registrar eventos automáticos no billing_history durante sync Hubla

### Problema
Quando o sync do Hubla roda e marca parcelas como pagas, nenhum registro é criado no `billing_history`. A aba Histórico fica vazia.

### Solução
No `sync-billing-from-hubla/index.ts`, após marcar parcelas como pagas (tanto updates quanto inserts), inserir registros em `billing_history` com tipo `parcela_paga`.

### Mudanças no `supabase/functions/sync-billing-from-hubla/index.ts`

**1. Coletar eventos durante o processamento:**
- Criar array `historyEntries` no início de cada batch
- Quando uma parcela existente é atualizada para "pago" (linha ~332-347), adicionar entrada com tipo `parcela_paga`, valor, forma de pagamento e descrição "Parcela X/Y paga via Hubla (sync automático)"
- Quando parcelas novas são inseridas já como "pago" (linha ~302-312), adicionar entrada similar

**2. Bulk insert no billing_history:**
- Após processar installments de cada batch, inserir todos os `historyEntries` em chunks de 500
- Campos: `subscription_id`, `tipo: 'parcela_paga'`, `valor`, `forma_pagamento`, `responsavel: 'Sistema (Hubla Sync)'`, `descricao`, `metadata` com `hubla_transaction_id` e `numero_parcela`

### Resultado
Ao abrir a aba Histórico de qualquer assinatura, os pagamentos sincronizados via Hubla aparecerão automaticamente com data, valor e número da parcela.

### Arquivo afetado

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/sync-billing-from-hubla/index.ts` | Adicionar inserts em billing_history para parcelas pagas |

