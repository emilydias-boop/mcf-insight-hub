
# Plano: Corrigir Discrepância de Contagem de Contratos (31 vs 32)

## Problema Identificado

O KPI "Contratos" mostra **31** enquanto a tabela de Closers mostra **32**. A diferença é causada por **1 registro inconsistente**:

| Campo | Valor |
|-------|-------|
| Cliente | Francisco Antonio da Silva Rocha |
| ID | f3205837-1f29-41a5-99c8-94540074aa8d |
| Status atual | `completed` |
| contract_paid_at | 2026-02-03 14:00:00 |
| Closer | Cristiane Gomes |
| SDR | caroline.souza@minhacasafinanciada.com |

## Causa Raiz

- **KPI Card**: Usa RPC `get_sdr_metrics_from_agenda` que filtra por `status IN ('contract_paid', 'refunded')`
- **Tabela Closers**: Usa hook `useR1CloserMetrics` que filtra por `contract_paid_at IS NOT NULL`

Francisco tem `contract_paid_at` preenchido, mas o status ficou como `completed` (provavelmente um pagamento manual ou erro de sincronização).

---

## Solucao Recomendada: Corrigir o Status do Registro

Execute este SQL no **Cloud View > Run SQL** (ambiente Live):

```sql
-- Corrigir status do Francisco para contract_paid
UPDATE meeting_slot_attendees 
SET status = 'contract_paid'
WHERE id = 'f3205837-1f29-41a5-99c8-94540074aa8d'
  AND status = 'completed'
  AND contract_paid_at IS NOT NULL;
```

---

## Resultado Esperado

Apos executar:
- **KPI Card "Contratos"**: 32
- **Tabela Closers Total**: 32
- Ambos sincronizados

---

## Nota Tecnica

Essa inconsistencia pode ocorrer quando:
1. O pagamento foi registrado manualmente sem atualizar o status
2. O webhook Hubla preencheu `contract_paid_at` mas falhou ao atualizar o status
3. Houve uma condicao de corrida entre o webhook e uma acao manual

O codigo ja esta correto - apenas este registro historico precisa de correcao.
