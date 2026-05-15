## Objetivo

Permitir que SDRs específicos (ex.: Caroline Corrêa) possam **transferir leads para outros SDRs** pela aba **CRM → Contatos**, controlado por um toggle individual na ficha do usuário.

Hoje qualquer perfil `sdr` / `closer` / `closer_sombra` é tratado como read-only em `Contatos.tsx` (`isReadOnly = true`), o que esconde a barra de ações em massa (incluindo o botão "Trocar SDR/Owner" que abre o `BulkTransferDialog`). Vamos liberar essa ação específica via capability por usuário, no mesmo padrão das permissões avançadas da Agenda.

## Mudanças

### 1. Banco
Migration nova adicionando coluna em `profiles`:
- `can_transfer_leads boolean not null default false`

Admins, managers e coordenadores continuam com tudo liberado por padrão (não usam a flag).

### 2. Toggle na ficha do usuário
Em `src/components/user-management/UserDetailsDrawer.tsx`, dentro do card **"Permissões avançadas"** (renomear de "Permissões avançadas da Agenda" para **"Permissões avançadas"**, já que vai ganhar item fora da agenda; ou manter card e adicionar uma subseção "CRM"):

Adicionar item:
- **Transferir leads (Contatos)** — "Permite selecionar contatos na aba Contatos e transferir o owner do negócio para outro SDR."

Reaproveitar `handleToggleAgendaCap` generalizando para `handleToggleCap` (mesmo update em `profiles`, mesma invalidação de cache + nova key `my-contacts-capabilities`).

Atualizar:
- `src/hooks/useUsers.ts` (carregar `can_transfer_leads`)
- `src/types/user-management.ts` (`UserDetails.can_transfer_leads?: boolean`)

### 3. Hook de capability
Novo `src/hooks/useMyContactsCapabilities.ts` (espelho do `useMyAgendaCapabilities`):
- admin / manager / coordenador → `canTransferLeads: true`
- demais → lê `profiles.can_transfer_leads` do usuário logado

### 4. Liberar ação em Contatos
Em `src/pages/crm/Contatos.tsx`:
- Manter `isReadOnly` para criar/editar contato.
- Introduzir `canTransferLeads` vindo do novo hook.
- Renderizar `BulkActionsBar` + `BulkTransferDialog` quando `!isReadOnly || canTransferLeads`, mas com props **restritas** quando o usuário não é gestor:
  - Mostrar somente `onChangeOwner` (abre `BulkTransferDialog`).
  - Não passar `onTransfer` (Pipeline), `onDuplicate`, `onMoveStage`, `onMovePipeline`.
- Manter a seleção via checkbox visível para esses usuários.

Sem mudanças no `BulkTransferDialog` ou no hook `useBulkTransfer` (já fazem o trabalho via `useTransferDealOwner`).

### 5. Memória
Adicionar `mem://auth/contacts-transfer-capability` documentando a flag e o comportamento (gestores liberados por padrão; SDR precisa do toggle).

## Validação
1. Logar como Caroline Corrêa (SDR) → aba Contatos → sem toggle, nenhuma barra de ações aparece (comportamento atual).
2. Admin ativa o toggle "Transferir leads" na ficha dela → ela passa a ver checkboxes e o botão "Trocar Owner" → consegue abrir `BulkTransferDialog` e transferir negócios para outro SDR.
3. Outras ações (criar contato, mover pipeline, mover etapa, duplicar) seguem ocultas para ela.
4. Admin/Manager/Coordenador continuam com a barra completa, independente da flag.
