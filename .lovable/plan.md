## Automação: WhatsApp "Boas-vindas R2" ao marcar Contrato Pago (R1)

### Objetivo
Disparar automaticamente uma mensagem no WhatsApp para o lead assim que ele for marcado como **Contrato Pago** na Agenda R1, com o texto aprovado abaixo, via Twilio, controlado pelo módulo **Administração → Automações**.

### Mensagem final aprovada
```
Olá, {{nome}}! 🎉

Parabéns pela decisão — seu contrato foi confirmado e você agora faz parte da Seleção MCF.

SEUS PRÓXIMOS PASSOS — O que fazer agora:

1) Acesse o conteúdo na MCF Pay
Lá estão os detalhes do contrato e a explicação completa do nosso modelo de negócio (Acesso no seu email).

2) Agende sua reunião de seleção
O passo que garante sua vaga. É a reunião com um sócio da MCF — sem ela, você não avança.
👉 Agende sua R2 aqui: https://hi.switchy.io/x9NB

3) Entre no grupo dos selecionados
No mesmo contato acima você recebe informações sobre a abertura das vagas e a reunião com a equipe.

Qualquer dúvida, é só chamar por aqui. Nos vemos na R2! 🚀
```
(Placeholder `{{nome}}` = primeiro nome do contato do deal.)

### Escopo do gatilho
- Evento: `attendee_contract_paid` — disparado sempre que um `meeting_slot_attendees` do tipo R1 passa a ter `contract_paid_at IS NOT NULL` (marcação manual do Closer OU vinculação de contrato Hubla/MCF Pay via `useLinkContractToAttendee`).
- Vale para **todas as BUs** (mesmo padrão dos outros disparos do módulo).
- Excluir sócios (`is_partner = true`) e produtos parceria/renovação (A001–A009, R001) — mesmas regras já usadas no restante do sistema.

### Idempotência
- Novo campo `boas_vindas_r2_whatsapp_enviado_em timestamptz` em `meeting_slot_attendees`.
- Dispara apenas quando o campo estiver nulo; ao enviar com sucesso, preenche com `now()`.
- Se o attendee for remarcado/despago e voltar a ficar pago, **não reenvia** (respeita histórico).

### Componentes técnicos

1. **Migração DB**
   - Adiciona `boas_vindas_r2_whatsapp_enviado_em` em `meeting_slot_attendees`.
   - Registra o novo evento na tabela `automation_flows` como opção de `system_event` (`attendee_contract_paid`).

2. **Front — Administração → Automações**
   - `src/components/automations/FlowEditorDialog.tsx`: adiciona `attendee_contract_paid` na lista de gatilhos de sistema, com o template padrão da mensagem acima pré-preenchido e o canal `whatsapp`.
   - Permite ao admin editar texto/link/ativar/desativar como já faz com "Boas-vindas Consórcio" e "Confirmação R1".

3. **Edge function `automation-event-dispatcher`** (já existe)
   - Adiciona handler para `attendee_contract_paid`:
     - Recebe `attendee_id`.
     - Busca attendee + deal + contact (nome, telefone E.164).
     - Aplica exclusões (sócio, produtos parceria).
     - Checa idempotência (`boas_vindas_r2_whatsapp_enviado_em IS NULL`).
     - Renderiza template do fluxo ativo, substitui `{{nome}}`.
     - Chama Twilio via connector gateway (`/Messages.json`, `From = whatsapp:<numero>`, `To = whatsapp:<telefone>`).
     - Em sucesso: preenche timestamp e grava log em `automation_logs`.
     - Em falha: grava log com erro e retorna 200 (não bloqueia).

4. **Ponto de disparo (backend)**
   - Novo trigger PL/pgSQL em `meeting_slot_attendees` (`AFTER UPDATE OF contract_paid_at`) que, quando o valor transita de NULL → NOT NULL, chama `pg_net` (mesmo padrão dos webhooks existentes) para invocar `automation-event-dispatcher` com `{ event: 'attendee_contract_paid', attendee_id }`.
   - Isso cobre os dois caminhos: marcação manual do Closer e `useLinkContractToAttendee` (Hubla / MCF Pay), sem precisar mexer no front.

5. **Conector Twilio**
   - Requer conexão Twilio via `standard_connectors--connect` com um número WhatsApp habilitado (Business/Sandbox).
   - Após conectar, o secret `TWILIO_API_KEY` fica disponível para a edge function.
   - Guardar o número de origem em `automation_settings` (chave `whatsapp_from_number`) para o admin poder ajustar sem redeploy.

### Fora de escopo
- Não altera fluxo do Consórcio (boas-vindas do cadastro de carta).
- Não altera métricas, payouts, no-show, nem stages de deal.
- Não envia SMS — apenas WhatsApp.

### Passos de implementação
1. Migração: coluna de idempotência + trigger `pg_net`.
2. Handler novo em `automation-event-dispatcher` + template default seed.
3. UI do FlowEditor com o novo evento pré-carregado.
4. Verificar/solicitar conexão Twilio e número WhatsApp de origem.
5. Teste ponta a ponta: marcar um attendee como Contrato Pago em ambiente controlado, conferir log em `automation_logs` e recebimento no WhatsApp.
