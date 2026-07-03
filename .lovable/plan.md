# Check-in MCF — Sprint 1

Módulo para substituir grupos de WhatsApp pós-compra. Cria uma Sala de Atendimento individual (cliente ↔ equipe) automaticamente após compra do A000 – Contrato, com painel interno estilo caixa de entrada e área pública do cliente via link com token.

## Escopo desta sprint
- Salas 1:1 (cliente + equipe interna, sem múltiplos clientes).
- Mensagens de texto puro (sem anexos/áudio/emoji reactions).
- Realtime via Supabase Realtime, badge de não lidas, sem email/push.
- Cliente acessa por link único com token na URL (sem login).
- Sem IA, sem base de conhecimento, sem automações, sem dashboards — apenas fundação de dados e UI.

## Backend (Supabase)

### Tabelas novas (migration)
1. `checkin_rooms`
   - `customer_name`, `customer_email`, `customer_phone`
   - `product_name`, `purchase_date`
   - `hubla_transaction_id` (FK opcional), `attendee_id` (FK opcional), `deal_id` (FK opcional)
   - `assigned_to` (uuid → profiles, nullable — atribuído na primeira resposta)
   - `squad_id` (uuid → squads, nullable — usado para gating de acesso)
   - `status` enum `checkin_room_status`: `novo | em_atendimento | aguardando_cliente | concluido` (default `novo`)
   - `access_token` (text, unique — gerado com `gen_random_bytes`, usado na URL pública)
   - `last_message_at`, `last_message_preview`
   - `unread_for_team`, `unread_for_customer` (int)
   - `created_at`, `updated_at`
2. `checkin_messages`
   - `room_id` (FK)
   - `sender_type` enum `checkin_sender`: `customer | staff | system`
   - `sender_user_id` (nullable), `sender_name`
   - `body` (text)
   - `sent_at`, `delivered_at`, `read_at` (para indicadores enviada/entregue/lida do cliente)
3. `checkin_room_events` (auditoria leve: criação, atribuição, reatribuição, mudança de status)

Habilitar Realtime nas duas primeiras.

### RLS
- `checkin_rooms` / `checkin_messages`:
  - `admin` e `coordenador`: SELECT/UPDATE tudo.
  - Demais autenticados: SELECT/UPDATE apenas se `squad_id` estiver no squad do usuário OU `assigned_to = auth.uid()` OU sala sem squad definido (fila geral).
  - Cliente NÃO usa RLS direta — acesso público é via Edge Function com token.
- GRANT SELECT/INSERT/UPDATE para `authenticated`; ALL para `service_role`; sem `anon`.

### Trigger de criação automática
Trigger em `hubla_transactions` AFTER INSERT/UPDATE: se `product_name` contém `A000` e `sale_status IN ('completed','paid')` e `net_value > 0`, cria `checkin_rooms` (se ainda não existir para o email). Também trigger em `meeting_slot_attendees` quando `contract_paid_at` é definido, cobrindo o segundo gatilho.

### Edge Functions
- `checkin-customer` (verify_jwt=false): endpoints `GET /room?token=…`, `GET /messages?token=…`, `POST /messages` (body do cliente), `POST /mark-read`. Valida `access_token`, atualiza `unread_for_*`, `last_message_*` e `delivered_at/read_at`.
- `checkin-create-manual` (verify_jwt=true): botão manual da equipe, valida role, insere sala.

## Frontend

### Rota interna `/checkin` (equipe)
Nova entrada no sidebar principal. Layout 3 colunas usando shadcn:
- **Esquerda** (`ScrollArea`): lista de salas ordenada por `last_message_at desc`, filtro por status (tabs), `Input` de busca (nome/telefone/email), badge de não lidas por sala. Realtime subscribe.
- **Centro**: header (nome, produto, `Select` de status, `Select` de responsável para reatribuição), transcrição em bolhas (staff vs customer), `Textarea` + botão enviar. Primeira mensagem staff atribui `assigned_to = auth.uid()` se null.
- **Direita**: card com nome, telefone, email, produto, data de compra. Somente leitura.
- Botão "Nova sala" (admin/coordenador) abre `Dialog` com busca em `hubla_transactions` para criar sala avulsa.

Gating: usar `RoleGuard`; ocultar salas fora do squad para não-admin/coordenador (garantido também pela RLS).

### Rota pública `/checkin/sala/:token`
Página standalone (sem sidebar/AuthContext), responsiva:
- Header com título "Check-in MCF" e mensagem de boas-vindas.
- Lista de mensagens (bolhas cliente à direita, equipe à esquerda) com indicadores ✓ enviada / ✓✓ entregue / ✓✓ azul lida.
- `Textarea` fixo no rodapé com botão enviar.
- Realtime subscribe via canal filtrado por `room_id` (função edge devolve `room_id` + configura canal anônimo já que anon key é suficiente para escutar Realtime; escrita continua via edge function).

## Hooks / arquivos previstos
- `src/hooks/checkin/useCheckinRooms.ts`, `useCheckinRoom.ts`, `useCheckinMessages.ts`, `useSendCheckinMessage.ts`, `useAssignRoom.ts`, `useUpdateRoomStatus.ts`.
- `src/hooks/checkin/useCustomerRoom.ts` (chama edge function com token).
- `src/pages/checkin/CheckinInbox.tsx` (equipe) e `src/pages/checkin/CustomerRoom.tsx` (público).
- `src/components/checkin/RoomList.tsx`, `RoomHeader.tsx`, `MessageThread.tsx`, `MessageComposer.tsx`, `CustomerInfoPanel.tsx`, `CreateRoomDialog.tsx`.
- Rotas adicionadas em `src/App.tsx` (rota pública fora do `MainLayout`/`ProtectedRoute`).

## Fora de escopo (futuro)
IA, base de conhecimento, automações, dashboards, notificações externas, anexos, integrações WhatsApp — a arquitetura de tabelas/eventos já suporta, mas não será construída agora.

## Detalhes técnicos
- Token: `encode(gen_random_bytes(24), 'base64url')` armazenado em coluna com índice único.
- URL do cliente: `${VITE_PUBLIC_APP_URL || window.location.origin}/checkin/sala/{token}`.
- Realtime: canais `checkin-room-{id}` filtrando `room_id`.
- Contadores de não lidas atualizados no servidor (trigger AFTER INSERT em `checkin_messages` incrementa `unread_for_*` conforme `sender_type`; edge function/hook zera ao marcar lida).
- Status transiciona automaticamente: `novo` → `em_atendimento` na primeira resposta staff; `em_atendimento` → `aguardando_cliente` quando staff envia; volta para `em_atendimento` quando cliente responde; `concluido` apenas manual.
