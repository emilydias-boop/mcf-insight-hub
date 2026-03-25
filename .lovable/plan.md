

## Liberar aba Contatos (somente leitura) para SDRs

### Problema
SDRs não conseguem ver a aba "Contatos" no CRM porque estão no grupo `agendaOnlyRoles`, que restringe a navegação apenas a Agenda R1 e Negócios.

### Alterações

#### 1. `src/pages/CRM.tsx` — Adicionar `/crm/contatos` às abas permitidas para SDRs
- Na lista `allowedTabs` dentro do bloco `isAgendaOnly`, adicionar `'/crm/contatos'`

#### 2. `src/pages/crm/Contatos.tsx` — Ocultar ações de escrita para SDRs
- Importar `useAuth` e verificar se o role é SDR
- **Ocultar** para SDRs:
  - Botão "Sincronizar"
  - Botão "Novo Contato"
  - Checkboxes de seleção (coluna + "Selecionar todos")
  - `BulkActionsBar` (transferir, duplicar)
  - `SendToPipelineModal`
  - `DuplicateToInsideDialog`
  - `ContactFormDialog`
- **Manter** para SDRs:
  - Busca, filtros, tabela (somente visualização)
  - Click na row para abrir `ContactDetailsDrawer` (somente leitura)

#### 3. `src/components/crm/ContactDetailsDrawer.tsx` — Verificar se há ações de edição a ocultar
- Revisar o drawer para ocultar botões de edição/exclusão para SDRs (se existirem)

### Resultado
SDRs poderão acessar a aba Contatos, buscar e visualizar leads com o drawer de detalhes, mas sem nenhuma ação de criação, edição, movimentação ou seleção em massa.

