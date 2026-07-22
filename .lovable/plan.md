## Objetivo
Centralizar em **Administração → Automações** o envio de mensagens pós-cadastro de carta de consórcio, permitindo escolher canal (E-mail Brevo e/ou WhatsApp Twilio) e editar template. Remover o envio hardcoded atual do hook de cadastro.

## Mudanças

### 1. Banco (migração)
- `automation_flows`: adicionar
  - `trigger_type` text ('stage_change' | 'system_event') default 'stage_change'
  - `trigger_event` text nullable (ex.: `consorcio_carta_cadastrada`)
  - `channel` text ('email' | 'whatsapp' | 'both') default 'email'
  - `subject` text nullable (assunto e-mail)
  - `body_template` text nullable (corpo unificado, suporta `{{nome}}`, `{{grupo}}`, `{{cota}}`)
- `consorcio_pending_registrations`: adicionar
  - `boas_vindas_email_enviado_em` timestamptz
  - `boas_vindas_whatsapp_enviado_em` timestamptz
- Seed: criar 1 flow "Boas-vindas Carta Cadastrada" com trigger `consorcio_carta_cadastrada`, canal `both`, template atual do e-mail convertido para texto/HTML.

### 2. Edge functions
- Nova: `automation-event-dispatcher` — recebe `{ event, registration_id }`, busca flows ativos com `trigger_event=event`, para cada um envia via canal escolhido:
  - Email: reutiliza chamada Brevo já existente (mesma lógica de CC para emily/antony).
  - WhatsApp: chama `twilio-whatsapp-send` com telefone do lead (E.164).
  - Marca timestamps de idempotência na `consorcio_pending_registrations`.
- Retorna log estruturado; grava em `automation_logs`.

### 3. Frontend
- `useConsorcioPendingRegistrations.ts`: remover envio Brevo inline; ao concluir cadastro chamar `automation-event-dispatcher` com evento `consorcio_carta_cadastrada`.
- `Automacoes.tsx` (`/admin/automacoes`): no editor de flow, adicionar:
  - Toggle "Gatilho": Mudança de etapa CRM | Evento do sistema
  - Se Evento: dropdown com `Carta de Consórcio Cadastrada`
  - Seletor de canal (Email / WhatsApp / Ambos)
  - Campo Assunto (email), Editor de corpo com placeholders documentados
  - Preview simples renderizando placeholders com dados fake.

### 4. Idempotência e reenvio
- Botão "Reenviar" na tela de Cadastros → dispara mesmo evento, ignora timestamps se `force=true`.

## Fora do escopo
- Não altera fluxos existentes de mudança de etapa CRM.
- Não cria HSM templates novos no Twilio (usar template já aprovado; se ausente, mensagem só será entregue em janela de 24h — anotado em UI).

## Detalhes técnicos
- Placeholders resolvidos server-side no dispatcher a partir de `consorcio_pending_registrations` + join com deal/lead para telefone.
- Telefone normalizado para E.164 antes do envio.
- CC do e-mail (emily, antony) permanece; podendo ser configurável no flow em iteração futura.
