**Diagnóstico atual**
- HMAC do callback já valida (`200` na assinatura).
- O MCF Pay envia `data.deal_id = 7f293b67...`, mas esse UUID não existe em `crm_deals`. Não há `mcf_pay_transaction_id` gravado em nenhum deal.
- Resultado: `404 deal_not_found` em todas as tentativas.

**Estratégia: usar o cliente (nome/email/telefone) como chave de reconciliação**

Em vez de depender só do `deal_id`, vamos casar o pagamento ao lead pelos dados do cliente que o MCF Pay já conhece.

1. **Outbound CRM → MCF Pay (`notify-mcf-pay`)**
   - Continuar enviando `crm_deal_id`.
   - Passar a enviar também `customer`: `{ name, email, phone_e164, phone_digits }` extraídos de `crm_contacts` via `crm_deals.contact_id`.
   - Isso permite ao MCF Pay devolver os mesmos campos no callback e também ajuda a operação deles.

2. **Inbound MCF Pay → CRM (`mcf-pay-callback`)**
   Resolver o deal por esta cadeia, parando no primeiro acerto:
   1. `data.crm_deal_id` (novo, preferencial)
   2. `data.deal_id` direto em `crm_deals.id`
   3. `data.metadata.crm_deal_id`
   4. `crm_deals.custom_fields->>mcf_pay_transaction_id == data.transaction_id`
   5. **Por cliente** (`data.customer` ou campos planos `customer_email`, `customer_phone`, `customer_name`):
      - email: `lower(crm_contacts.email) = lower(payload.email)`
      - telefone: comparar últimos 9 dígitos (padrão do projeto) contra `crm_contacts.phone`
      - nome: `unaccent(lower(...))` como desempate
      - Estratégia de escolha:
        - se 1 deal único bater, usar.
        - se vários, preferir deal com R2 mais recente e/ou ainda sem `contract_paid_at` em attendees.
        - se 0 ou ambíguo, registrar `deal_not_found_ambiguous` com a lista de candidatos no log para reconciliação manual.

3. **Persistir o vínculo após o primeiro casamento**
   - Quando o deal for resolvido por cliente, gravar `mcf_pay_transaction_id` no `custom_fields` do deal — próximos eventos da mesma transação resolvem direto.

4. **Telemetria/UX**
   - Log inbound passa a registrar `match_strategy` (`deal_id` / `transaction_id` / `customer_email` / `customer_phone` / `customer_name`).
   - Na aba "Recebidos" da tela `/admin/integracao-mcf-pay`, exibir a estratégia usada e, em caso de ambíguo, listar os deals candidatos com botão "Vincular este deal".

5. **Reaplicar pagamento ao vincular manualmente**
   - Ao escolher um deal candidato, reexecutar a lógica de marcação (`contract_paid_at`, `status = contract_paid` no attendee, atualização de `custom_fields`).

6. **Validar**
   - Reenviar o webhook do MCF Pay com o cliente real → deve retornar `200` e marcar pago em agendas/relatórios.
   - Confirmar que o `mcf_pay_transaction_id` ficou salvo no deal para reenvios futuros.

**O que preciso do MCF Pay (mensagem pronta)**
Pedir para incluírem no payload `payment.confirmed`:
```
"customer": {
  "name": "...",
  "email": "...",
  "phone": "+55119..."
}
```
Mesmo sem isso, se a invoice no MCF Pay tiver email/telefone do cliente, qualquer um dos três já é suficiente para o casamento.