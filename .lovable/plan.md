
## O que vamos construir

Um canal WhatsApp compartilhado dentro da tela **MCF - Atendimento**:

- Um único número Twilio (WhatsApp Business) usado por todos os operadores autorizados.
- Cliente recebe no WhatsApp dele; qualquer operador com permissão vê e responde de dentro do app.
- Toda a conversa fica registrada, com autor de cada mensagem enviada.
- Tempo real via Supabase Realtime — mensagens novas aparecem sem refresh.
- Botão "Iniciar conversa" que dispara o template aprovado com a data-limite (hoje + 2 dias) preenchida automaticamente.

## Escopo desta entrega

**Incluso:**
1. Tabelas `wa_conversations`, `wa_messages`, `mcf_atendimento_access` (lista de usuários permitidos).
2. Edge function `twilio-wa-webhook` — recebe mensagens do cliente (Twilio → app).
3. Edge function `twilio-wa-send` — envia mensagens escritas pelo operador.
4. Edge function `twilio-wa-start` — envia o template inicial já com `{{1}} = data + 2 dias úteis`.
5. Painel na tela **MCF - Atendimento**:
   - Lista de conversas WhatsApp à esquerda (contato, última mensagem, badge de não lidas).
   - Painel de chat à direita com histórico + input para responder.
   - Botão "Iniciar conversa WhatsApp" (colar telefone + nome, ou originado do contrato A000).
6. Gestão de acesso: nova aba em Configurações onde admin adiciona/remove usuários que podem ver e responder.
7. Sandbox Twilio funciona de imediato para testes; ao aprovar o template basta trocar 2 secrets.

**Fica para fase 2 (aviso explícito):**
- **Auto-agendamento R2 na agenda Incorporador MCF quando o cliente escolher horário.** Isso exige: parser da resposta do cliente (linguagem natural → data/hora), consulta de disponibilidade real na agenda R2 filtrada por BU Incorporador, criação do slot com "Observações R2 = agendamento automático MCF - Atendimento". É um bloco grande e melhor validar o fluxo básico de mensageria antes. Nessa entrega, quando o cliente responder, a mensagem chega para o operador humano tratar.

## Configuração Twilio (o que você faz)

1. Vou pedir 3 secrets: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` (formato `whatsapp:+14155238886` para sandbox, ou seu número aprovado).
2. Para testes agora: use o Sandbox do Twilio (`whatsapp:+14155238886`) — cada testador manda o código join do sandbox uma vez.
3. Quando o template for aprovado: adiciono secret `TWILIO_WA_TEMPLATE_SID` (ContentSid) e o send passa a usar template.
4. No console Twilio, aponte o webhook "When a message comes in" para: `https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/twilio-wa-webhook`.

## Detalhes técnicos

**Tabelas:**
- `wa_conversations(id, phone_e164, contact_name, deal_id nullable, last_message_at, last_message_preview, unread_count, created_at)`
- `wa_messages(id, conversation_id, direction 'inbound'|'outbound', body, twilio_message_sid, sent_by_user_id nullable, status, created_at)`
- `mcf_atendimento_access(user_id PK, granted_by, granted_at)`
- RLS: SELECT/INSERT em `wa_*` só para usuários em `mcf_atendimento_access` ou admins. Webhook usa service role (bypass RLS).
- Realtime habilitado em `wa_messages` e `wa_conversations`.

**Edge functions (verify_jwt=false no webhook, true nas demais):**
- `twilio-wa-webhook`: valida assinatura Twilio, upsert conversation, insert message inbound.
- `twilio-wa-send`: valida que usuário tem acesso, chama gateway Twilio `POST /Messages.json`, persiste outbound.
- `twilio-wa-start`: monta `contentVariables` com data D+2 (formato pt-BR) e envia via `ContentSid`.

**Frontend:**
- `src/pages/checkin/CheckinInbox.tsx` ganha uma sub-aba/seção "WhatsApp".
- Componentes novos: `WaConversationList`, `WaChatPane`, `WaStartConversationDialog`.
- Nova página `src/pages/settings/McfAtendimentoAccess.tsx` para gerenciar quem tem acesso.

## Confirmação antes de rodar

Como o auto-agendamento R2 não entra nesta primeira fase, confirma se posso seguir com a mensageria compartilhada + template inicial agora, e a gente trata o auto-agendamento como próximo passo depois de validar o fluxo?
