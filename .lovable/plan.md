

## Problema: Contratos não vinculados automaticamente à transação Hubla

### Diagnóstico

A função `autoMarkContractPaid` nos webhooks (`hubla-webhook-handler` e `webhook-make-contrato`) marca o attendee como `contract_paid` corretamente, **mas não cria o vínculo** com a transação Hubla (`hubla_transactions.linked_attendee_id`).

**Dados de Fevereiro/2026:**
- 196 contratos marcados como pagos na agenda
- Apenas **12** têm vínculo com transação Hubla (via `LinkContractDialog` manual)
- **184** estão sem vínculo — todos foram marcados pelo webhook automaticamente, mas sem o link

Isso significa que o sistema está correto na **detecção** (encontra o attendee certo), mas falha na **rastreabilidade** — não conecta a transação à reunião.

### Causa Raiz

A interface `AutoMarkData` não inclui o `hubla_id` da transação. A função recebe apenas email/telefone/nome e data, mas não sabe **qual transação** disparou a marcação.

### Solução

**1. `supabase/functions/hubla-webhook-handler/index.ts`**
- Adicionar `transactionHublaId` à interface `AutoMarkData`
- Na função `autoMarkContractPaid`, após marcar o attendee como `contract_paid`, também atualizar `hubla_transactions.linked_attendee_id = matchingAttendee.id` usando o `transactionHublaId`
- Nos dois pontos que chamam `autoMarkContractPaid` (linhas ~1631 e ~1773), passar o `hublaId` da transação

**2. `supabase/functions/webhook-make-contrato/index.ts`**
- Mesma alteração na interface `AutoMarkData` local e na função `autoMarkContractPaid`
- No call site (linha ~494), passar o `insertedData.hubla_id`

**3. `src/components/crm/MeetingSearchPanel.tsx`**
- Remover o botão manual "Marcar Contrato Pago" (ícone `$`) que ainda existe no painel de busca
- Manter apenas o badge "✅ Pago" para exibição e o botão de abrir detalhes
- Remover imports não utilizados (`useMarkContractPaid`, `DollarSign`)

### Lógica do vínculo (adição ao autoMarkContractPaid)

```
// Após marcar attendee como contract_paid:
if (data.transactionHublaId) {
  await supabase
    .from('hubla_transactions')
    .update({ linked_attendee_id: matchingAttendee.id })
    .eq('hubla_id', data.transactionHublaId);
}
```

### Resultado esperado
- Novos contratos serão automaticamente vinculados à transação Hubla que os gerou
- O painel não terá mais botão manual de marcação
- A rastreabilidade fica completa: transação Hubla ↔ attendee ↔ closer ↔ deal
- Contratos históricos sem vínculo permanecem (dados passados), mas novos já terão o link correto

