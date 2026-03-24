

## Correção: move-partners deve respeitar proteção de funil (reuniões)

### Problema

A função `move-partners-to-venda-realizada` (cron a cada 6h) move TODO deal de parceiro para "Venda Realizada" sem verificar se o lead tem reunião R1/R2 agendada. A importação tem essa proteção, mas o cron não.

Resultado: Maiquel tinha um deal ativo com reunião no funil e foi movido automaticamente, quebrando a regra de proteção de funil.

### Regra correta

Se o deal/contato tem uma reunião (R1 ou R2) registrada em `meeting_slot_attendees`, o cron **não deve** alterar o estágio. O lead deve permanecer no estágio atual para ser trabalhado pelo closer/SDR.

### Solução

Adicionar verificação no `move-partners-to-venda-realizada` para excluir deals cujos contatos tenham reuniões ativas.

### Detalhes técnicos

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/move-partners-to-venda-realizada/index.ts` | Após identificar `partnerDeals` (passo 6), buscar `meeting_slot_attendees` por `contact_email` ou `deal_id` para esses deals. Excluir da movimentação qualquer deal que tenha reunião registrada (qualquer status exceto `cancelled`). |

Lógica a adicionar entre os passos 6 e 7:

```text
partnerDeals (identificados)
  ↓
Buscar meeting_slot_attendees onde deal_id IN (partnerDeal IDs)
  ou contact_email IN (partnerEmails) com status != 'cancelled'
  ↓
Excluir esses deals da lista de movimentação
  ↓
Prosseguir com dry_run / execução apenas dos deals SEM reunião
```

Stats atualizadas incluirão `skipped_with_meetings` para visibilidade.

