## Objetivo
Adicionar um campo de texto livre **Origem do Lead** no cadastro de "Registrar Carta Negociada" e exibi-lo no painel **Concluídas - Operacional**.

## Onde aparece

1. **Modal "Registrar Carta Negociada"** (aba Reuniões Realizadas): nova caixa de texto abaixo de "Detalhes da Proposta", opcional.
2. **Modal "Editar Proposta"** (Cartas Negociadas e Concluídas): mesma caixa, para permitir corrigir depois.
3. **Tabela Concluídas - Operacional**: nova coluna **Origem do Lead** exibindo o valor (ou "—" quando vazio). Também incluída no export XLSX.

## Alterações técnicas

- **Migration**: adicionar coluna `origem_lead text` (nullable) em `consorcio_proposals`.
- `src/components/consorcio/ProposalModal.tsx`: novo `Input` "Origem do Lead" + envio no `useCriarProposta`.
- `src/components/consorcio/EditProposalModal.tsx`: novo `Input` + envio no `useEditarProposta`.
- `src/hooks/useConsorcioPostMeeting.ts`:
  - `useCriarProposta`: aceitar e gravar `origem_lead`.
  - `useEditarProposta`: aceitar e atualizar `origem_lead`.
  - Tipo `Proposal` e select da lista de propostas/concluídas: incluir `origem_lead`.
- `src/pages/crm/PosReuniao.tsx` (`ConcluidasTab`): nova coluna na tabela + campo no export.

Campo é **opcional** (não bloqueia salvamento) e permanece como texto livre.
