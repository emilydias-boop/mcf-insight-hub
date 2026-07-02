## Contexto
A migração de banco já foi aplicada:
- `build_sale_webhook_payload` agora inclui bloco `attribution` com `attendee_id`, `deal_id`, `contact_id`, `meeting_slot_id`, `meeting_scheduled_at`, `contract_paid_at`, `closer { id, name, email }` e `sdr { id, name, email }` sempre que a transação tem `linked_attendee_id`.
- Novo trigger `trg_outbound_sale_linked_webhook` em `hubla_transactions` dispara o evento `sale.linked` para todos os webhooks ativos inscritos nesse evento sempre que `linked_attendee_id` passa a ter valor.

## O que falta
Adicionar o novo evento `sale.linked` na lista `OUTBOUND_EVENTS` para que ele apareça como opção selecionável na tela de configuração de webhooks de saída.

## Alteração
**Arquivo:** `src/hooks/useOutboundWebhooks.ts`

Adicionar uma entrada em `OUTBOUND_EVENTS`:

```ts
{ value: 'sale.linked', label: 'Venda Vinculada (Closer/SDR)' },
```

Nada mais precisa mudar no frontend — a UI existente (`OutboundWebhookForm` etc.) itera sobre `OUTBOUND_EVENTS` para gerar os checkboxes.

## Passo seguinte para o usuário
Depois do deploy, abrir o webhook do MCF Pay em Configurações → Webhooks de Saída, marcar o evento **"Venda Vinculada (Closer/SDR)"**, salvar. A partir daí, cada vez que alguém clicar em "Vincular Contrato", o MCF Pay recebe o payload completo com Closer e SDR.
