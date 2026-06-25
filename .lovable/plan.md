## Plano

1. **Confirmar a permissão atual**
   - O Cleyton/Cleiton já está com `can_transfer_leads = true`, role `sdr` e squad `consorcio`.
   - A Carol Correa também usa a mesma flag (`can_transfer_leads = true`), então o problema não é o toggle em si.

2. **Corrigir a tela CRM > Negócios da BU Consórcio**
   - Hoje a permissão especial `can_transfer_leads` está aplicada principalmente em **CRM > Contatos**.
   - Vou aplicar a mesma regra em **CRM > Negócios/Kanban**, para SDR com essa flag conseguir usar a ação **Trocar dono**.
   - O botão vai abrir o mesmo `BulkTransferDialog`, reaproveitando a lógica já existente de transferência.

3. **Corrigir a troca individual no card do Kanban**
   - Hoje o avatar do card só abre a troca de dono para `admin`, `manager` e `coordenador`.
   - Vou permitir também para usuários com `can_transfer_leads = true`, como Cleyton e Carol.

4. **Manter segurança e escopo da BU**
   - O Cleyton continuará limitado aos deals que ele já consegue enxergar na BU Consórcio.
   - A lista de novos responsáveis continuará vindo do RPC `list_transferable_users`, que restringe SDRs/Closers a usuários da mesma squad/BU quando não são cargos privilegiados.

5. **Ajuste de nomenclatura visual**
   - Na barra de ações do Kanban, a ação será exibida como **Trocar dono**, igual à experiência de Contatos, evitando confusão com outras transferências.

## Detalhe técnico

- Alterar `src/pages/crm/Negocios.tsx` para consultar `useMyContactsCapabilities()` e usar `canTransferLeads` na ação de troca de dono.
- Alterar `src/components/crm/DealKanbanCard.tsx` para permitir abertura do `OwnerChangeDialog` quando o usuário tiver `can_transfer_leads`.
- Não criar nova tabela nem nova migration, porque a permissão já existe e está corretamente ativa para o Cleyton.