---
name: Contacts Transfer Capability
description: Toggle profiles.can_transfer_leads libera SDR/closer a usar "Trocar dono" na aba CRM > Contatos. Demais ações em massa continuam ocultas.
type: feature
---
Coluna `profiles.can_transfer_leads` (boolean, default false).

- Admin/Manager/Coordenador: ignoram a flag — sempre podem usar todas as ações em massa em /crm/contatos.
- SDR/Closer/Closer Sombra: por padrão a aba é read-only. Se `can_transfer_leads = true`, passam a ver checkboxes de seleção e somente o botão "Trocar dono" (abre `BulkTransferDialog`). Continuam sem acesso a Enviar p/ Pipeline, Mover Etapa, Mover Pipeline, Duplicar e Novo Contato.

Toggle na ficha do usuário em `UserDetailsDrawer` → card "Permissões avançadas do CRM".

Hook `useMyContactsCapabilities` expõe `canTransferLeads` e respeita roles privilegiados.
