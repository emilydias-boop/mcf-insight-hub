## Diagnóstico encontrado

Em junho/2026, considerando contratos Hubla `invoice.payment_succeeded`:

- 172 contratos reais com valor (`invoice.payment_succeeded`).
- 36 estão sem `linked_attendee_id` → não entram corretamente para Closer/SDR quando deveriam.
- Desses 36, 27 já têm ou tiveram R1 no mesmo deal; ou seja, são recuperáveis por reconciliação.
- Existem também 185 eventos `NewSale` com valor 0; eles aparecem como contratos órfãos em algumas buscas, mas não devem ser usados para contabilização.

Causas principais:

1. **Race condition entre Hubla e Agenda**
   - O webhook tenta marcar contrato pago apenas no momento em que o pagamento chega.
   - Se o attendee R1 ainda não existe, está `pre_scheduled`, foi criado segundos/minutos depois, ou o agendamento chegou pelo Calendly depois, o contrato fica órfão.
   - Exemplo recente: Nestor pagou antes da R1 existir; Vinicius teve transações sem vínculo.

2. **Filtro atual ignora attendees importantes**
   - `autoMarkContractPaid` só considera attendee status `scheduled`, `invited`, `completed`.
   - Nos dados há casos com `pre_scheduled`, que ficam invisíveis para a atribuição automática.

3. **Vínculo parcial deixa dashboards divergentes**
   - Em alguns casos o `meeting_slot_attendees.contract_paid_at` foi marcado, mas `hubla_transactions.linked_attendee_id` continuou `NULL`.
   - Isso faz uma tela contar e outra não, dependendo da fonte usada.

4. **Atribuição ao closer errado pode ocorrer por match frágil**
   - Ordem atual: CPF → email → telefone → nome.
   - CPF/email são seguros, mas telefone e principalmente nome podem casar no attendee errado quando há duplicidade, email diferente, contatos duplicados ou compradores com dados divergentes.
   - Levantei 27 contratos vinculados em que o email do pagamento não bate com o email do contato/deal. Alguns podem ser legítimos (cliente usa outro email no checkout), mas são sinais de risco para queda em closer/SDR errado.

5. **Contabilização de SDR depende do `booked_by` do attendee correto**
   - Se o contrato vincula ao attendee errado, o SDR errado recebe.
   - Se `booked_by` está nulo, o SDR não recebe.
   - O Calendly tem fallback para herdar `meeting_slots.booked_by`, mas nem todos os fluxos garantem isso.

## Plano de correção

### 1. Ajustar o webhook Hubla para ser mais confiável

No `hubla-webhook-handler`:

- Ignorar `NewSale`/valor zero para qualquer contabilização de contrato.
- Ampliar a busca de attendees para incluir `pre_scheduled` quando houver `deal_id` e dados compatíveis.
- Ao encontrar attendee:
  - marcar `meeting_slot_attendees.status = 'contract_paid'`;
  - preencher `contract_paid_at` com `sale_date` real da Hubla;
  - vincular `hubla_transactions.linked_attendee_id`;
  - vincular também `hubla_transactions.linked_deal_id = matchingAttendee.deal_id`;
  - preencher `linked_method`, `linked_at`.

Hoje o webhook atualiza `linked_attendee_id`, mas não garante `linked_deal_id` no caminho principal.

### 2. Tornar o match mais seguro para evitar closer/SDR errado

Manter CPF e email como match forte.

Para telefone/nome:

- Só aceitar telefone se não houver múltiplos candidatos no período.
- Só aceitar nome se também bater telefone ou CPF parcial/documento; não usar nome sozinho como decisão final.
- Se houver ambiguidade, não atribuir automaticamente; deixar para fila de reconciliação/manual.

Isso reduz casos de venda cair em outro closer ou outro SDR.

### 3. Criar uma reconciliação automática para contratos órfãos

Criar função SQL/RPC ou rotina de backfill segura para reprocessar contratos reais que ficaram sem `linked_attendee_id`:

Critérios:

- `hubla_transactions.event_type = 'invoice.payment_succeeded'`
- `sale_status = 'completed'`
- `count_in_dashboard = true`
- `net_value > 0`
- produto/categoria de contrato
- `installment_number = 1`
- `linked_attendee_id IS NULL`

A reconciliação tenta localizar attendee R1 pelo mesmo deal/contato e janela segura:

- Preferência 1: mesmo deal já em `linked_deal_id`.
- Preferência 2: contato por email exato.
- Preferência 3: contato por telefone sufixo 9 dígitos, se único.
- Janela: R1 de até 14 dias antes do pagamento ou até 2 dias depois do pagamento (para cobrir race condition / agendamento tardio).
- Excluir partner/renewal conforme regra do projeto.
- Excluir Outside oficial: Outside deve ficar sem closer e contar como Outside para SDR/canal, não como venda do closer.

Quando encontrar match único:

- atualizar attendee para `contract_paid`;
- preencher `contract_paid_at` com data da venda;
- preencher `hubla_transactions.linked_attendee_id`, `linked_deal_id`, `linked_method = 'reconciled'`, `linked_at`.

### 4. Backfill de junho/2026

Rodar a reconciliação para junho/2026 e revisar o resultado:

- quantos contratos foram vinculados;
- quantos ficaram ambíguos;
- quantos são Outside;
- quantos não têm deal/contato e precisam de intervenção manual.

Não vou marcar `contract_paid_at` para Outside (como Nestor), porque isso atribuiria indevidamente ao closer.

### 5. Criar auditoria/relatório de inconsistências

Gerar uma consulta de auditoria para acompanhamento contínuo:

- contratos reais sem attendee;
- contratos com attendee pago mas transação sem link;
- transações cujo email Hubla diverge do contato do attendee;
- deals com mais de um attendee pago;
- attendee pago com `booked_by` nulo;
- contrato com `linked_deal_id` diferente do `attendee.deal_id`.

Isso permite identificar rapidamente quando houver nova falha.

## Resultado esperado

- Contratos vendidos por closer passam a contar para o closer correto via `meeting_slot_attendees.contract_paid_at`.
- SDR passa a receber via `booked_by` do attendee correto.
- Outside continua fora de closer e contabiliza como Outside.
- Casos ambíguos deixam de ser atribuídos automaticamente ao closer/SDR errado e ficam para revisão.
