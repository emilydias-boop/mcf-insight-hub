## Objetivo
Permitir que, na tela **Controle Consórcio → Cadastros Pendentes**, o usuário anexe (e remova) documentos tanto ao clicar em **Abrir** quanto na tela de **abertura de cota** (mesma modal `OpenCotaModal`, modos `open` e `view`).

## Contexto atual
- `OpenCotaModal` já lista documentos vinculados via `consortium_documents.pending_registration_id` (somente leitura, mostrados como links).
- `useOpenCota` já migra automaticamente os documentos de `pending_registration_id` para `card_id` quando a cota é criada — não precisa mexer nesse fluxo.
- Existe bucket `consorcio-documents` e padrão de upload já usado em `useConsorcioDocuments` (batch upload) e `UploadPendingDocumentsDialog`.

## Mudanças

### 1. Hook `src/hooks/useConsorcioDocuments.ts`
- Adicionar variantes que aceitam `pendingRegistrationId` no lugar de `cardId`:
  - `usePendingRegistrationDocuments(pendingRegistrationId)` — lista por `pending_registration_id`.
  - `useBatchUploadPendingDocuments()` — mesmo fluxo do batch atual, mas grava `pending_registration_id` em vez de `card_id`, e usa prefixo de storage `pending/<pendingRegistrationId>/...`.
  - `useDeletePendingDocument()` — remove arquivo do storage e a linha (invalidando a query `pending-reg-documents`).
- Manter as funções atuais (`useConsorcioDocuments`, `useBatchUploadDocuments`, `useDeleteConsorcioDocument`) inalteradas para não quebrar o resto do app.

### 2. Componente `src/components/consorcio/OpenCotaModal.tsx`
- Substituir o bloco somente-leitura de "Documentos" (linhas ~482–501) por uma seção interativa:
  - Lista de documentos existentes com link "Abrir" e botão de excluir (ícone lixeira). No modo `view` sem edição, mantém somente os links (sem excluir) — a edição libera o botão de excluir e o upload, seguindo o padrão `readOnly` já usado no modal.
  - Bloco "Adicionar documentos": `<Input type="file" multiple />` + lista dos arquivos selecionados com `Select` de tipo (`TIPO_DOCUMENTO_OPTIONS`) e botão "Enviar", reaproveitando exatamente a UX de `UploadPendingDocumentsDialog`.
  - Usar os novos hooks (`usePendingRegistrationDocuments`, `useBatchUploadPendingDocuments`, `useDeletePendingDocument`). A query antiga inline (`useQuery` em `consortium_documents`) é removida em favor do hook, mantendo a mesma `queryKey` `['pending-reg-documents', registrationId]` para invalidação consistente.
- O botão de anexar/excluir fica disponível nos dois modos:
  - **Modo `open`** (botão "Abrir" em Cadastros Pendentes): habilitado direto.
  - **Modo `view`**: habilitado quando o usuário clicar em "Editar" (estado `isEditing` já existente).

### 3. Sem migração de banco
- Coluna `consortium_documents.pending_registration_id` e as policies já existem (o modal já lê por essa coluna e `useOpenCota` já migra para `card_id`). Nenhuma mudança de schema/RLS.

### 4. Sem alteração no fluxo de abertura da cota
- Após "Abrir Cota", `useOpenCota` continua migrando os anexos para o `card_id` do consórcio criado, então os documentos anexados nessa tela aparecem normalmente no card final.

## Detalhes técnicos
- Storage path para pendentes: `pending/<pendingRegistrationId>/<timestamp>-<rand>.<ext>` para separar visualmente dos anexos já vinculados a cartas.
- URL: `createSignedUrl` com validade longa (1 ano), igual ao padrão atual do batch upload de cartas.
- Invalidations após upload/delete: `['pending-reg-documents', registrationId]` e `['pending-registrations']` para atualizar contadores de KPI se existirem.
- Toasts de sucesso/erro (`sonner`) no mesmo estilo dos outros hooks do arquivo.

## Fora de escopo
- Não altera `PendingRegistrationsList`, `AddPendingRegistrationModal`, `ViewRegistrationDialog` ou o fluxo do CRM Pós-Reunião.
- Não mexe em permissões/RLS existentes.
