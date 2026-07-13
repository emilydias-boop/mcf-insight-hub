## Objetivo
Permitir que o time consulte, dentro do próprio app, os emails de boas-vindas do consórcio disparados após o cadastro da cota. O log ficará na tela existente **Automações > Logs**, usando a tabela `automation_logs`.

## O que muda

### 1. Enriquecer o disparo do email
No hook `useCreatePendingRegistrations.ts`, ao invocar `brevo-send`, passar também:
- `dealId: input.deal_id` (para vincular o log ao negócio)
- `tags: ['consorcio_boas_vindas', 'pending_registration']` (já enviado hoje)

Isso permite rastrear qual lead recebeu o email e abrir o card do negócio a partir do log.

### 2. Persistir envios na tabela `automation_logs`
Alterar a edge function `supabase/functions/brevo-send/index.ts` para gravar um registro em `automation_logs` toda vez que for chamada:
- Antes de enviar: insere registro com `status = 'pending'`.
- Após sucesso da Brevo: atualiza para `status = 'sent'`, preenche `external_id` com o `messageId` da Brevo e `sent_at = now()`.
- Em caso de erro: atualiza para `status = 'failed'` e preenche `error_message`.
- Campos preenchidos:
  - `channel = 'email'`
  - `recipient = to`
  - `deal_id = dealId` (quando informado)
  - `content_sent = subject + htmlContent` (ou apenas `subject`, conforme prática atual)
  - `metadata = { tags, senderEmail, senderName, subject }`

A gravação será feita com cliente de service-role (`SUPABASE_SERVICE_ROLE_KEY`), garantindo que a edge function consiga inserir independentemente do usuário que disparou o cadastro.

### 3. Adicionar filtro por tag na consulta de logs
Atualizar o hook `useAutomationLogs.ts` para aceitar um novo filtro opcional `tag`. A consulta filtrará registros cujo `metadata->tags` contenha a tag informada, permitindo por exemplo:
- Ver todos os emails de boas-vindas do consórcio.
- Ver todos os emails de qualquer automação/tag específica.

### 4. Melhorar a tela de logs
Atualizar o componente `AutomationLogs.tsx` para:
- Exibir um campo de filtro por tag (texto livre ou chip fixo "consorcio_boas_vindas").
- Mostrar as tags do `metadata` na listagem, quando existirem.
- Manter os filtros existentes (canal, status, fluxo, busca por destinatário).

### 5. Verificar permissões
Confirmar que a tabela `automation_logs` já possui grants para `service_role` (ALL) e que as policies permitem leitura aos perfis adequados. Se necessário, ajustar RLS para que a tela de Automações continue exibindo os logs.

## Fora de escopo
- Não criar nova tabela (reaproveita `automation_logs`).
- Não alterar o template do email nem o fluxo de cadastro da cota.
- Não enviar cópia (CC) para Emily/Antony.

## Resultado esperado
Após aprovado e implementado, toda vez que um SDR cadastrar os dados da cota, o envio do email de boas-vindas aparecerá em **Automações > Logs**, filtrável por tag `consorcio_boas_vindas`, com destinatário, status (enviado/falha), data/hora e link com o negócio.