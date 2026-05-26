## Busca de lead Consórcio no modal "Adicionar Pendente"

Substituir o campo de texto "Nome completo / Razão social" por um combobox que busca leads do CRM nos pipelines da BU Consórcio e autopreenche os dados.

### UX
- Campo vira `Popover` + `Command` (mesmo padrão do `LinkExistingCotaModal`).
- A partir de 2 caracteres, dispara busca debounced em `crm_deals` → `crm_contacts`, restrita às origens da BU Consórcio (via `BUContext.activeBUOrigins`).
- Cada resultado mostra: nome do contato, CPF/CNPJ (se houver), telefone, origem (`crm_origins.display_name`) e estágio.
- Ao selecionar:
  - Preenche `nome` (ou `razao_social` conforme tipo de pessoa, detectando PJ se vier CNPJ).
  - Preenche `cpf`/`cnpj`, `telefone`, `email`.
  - Preenche `origem` com `origin.display_name` (editável).
  - Guarda `deal_id` no estado para enviar na mutação.
- Mantém opção "Usar '<texto>' como novo nome" quando não houver match, preservando o fluxo atual de cadastro 100% manual.
- Todos os campos continuam editáveis após o autofill.

### Backend / hook
- `useConsorcioPendingRegistrations.ts`:
  - Adicionar `deal_id?: string | null` em `CreateManualPendingInput`.
  - Incluir `deal_id` no `insert` (coluna já existe na tabela `consorcio_pending_registrations`).
- Nenhuma migration necessária.

### Arquivos
- Editar: `src/components/consorcio/AddPendingRegistrationModal.tsx` — combobox + autofill.
- Editar: `src/hooks/useConsorcioPendingRegistrations.ts` — aceitar `deal_id`.
- Reuso: `useActiveBU` / `BUContext` para limitar busca a pipelines Consórcio; padrão de query do `LinkExistingCotaModal` como referência.

### Fora de escopo
- Fluxo do closer no CRM permanece intacto.
- Não altera a tabela `consorcio_pending_registrations`.
