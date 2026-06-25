## Diagnóstico

Na aba **CRM > Contatos** o código já está praticamente pronto para o Cleyton transferir qualquer lead:

- `useContactsEnriched` busca **todos os contatos da BU ativa** (filtra só por `buOriginIds`, não por dono).
- RLS de `crm_contacts` e `crm_deals` permite SELECT/UPDATE para qualquer autenticado.
- Em `src/pages/crm/Contatos.tsx`, com `can_transfer_leads = true`:
  - `canBulkSelect = true` → checkbox aparece em toda linha.
  - `onChangeOwner` é exibido sempre que há deal selecionado, **independente do dono**.
- O `BulkTransferDialog` chama `useBulkTransfer`, que faz UPDATE direto em `crm_deals` por `id` — sem filtro por dono.

Ou seja, na teoria Cleyton já consegue. Provavelmente o que está acontecendo é um dos três cenários abaixo:

1. **Ele está usando a aba Negócios (Kanban)**, que por padrão só mostra os deals dele (filtro `ownerProfileId = user.id` em `Negocios.tsx:295`).
2. **Filtro "SDR" da própria aba Contatos** está aplicado no nome dele, escondendo os leads de outros.
3. **Algum contato selecionado não tem `latestDeal` na BU Consórcio** (ex.: deal arquivado), e por isso `selectedDealIds` ignora a linha. Hoje isso acontece silenciosamente.

## Plano

1. **Garantir, na aba Contatos, que SDR/Closer com `can_transfer_leads` veja todos os leads sem filtro de dono**
   - Revisar `src/pages/crm/Contatos.tsx` e remover/ajustar qualquer pré-filtro implícito por SDR ao montar `filteredContacts` quando `canTransferLeads = true`.
   - Confirmar que `filters.sdr` começa vazio (já está) e que nada está pré-selecionando o usuário logado.

2. **Dar feedback claro quando o contato selecionado não puder ser transferido**
   - Em `src/pages/crm/Contatos.tsx`, quando um contato selecionado não tem `latestDeal` na BU ativa, exibir um aviso (toast) no clique em "Trocar dono" listando quantos foram ignorados, em vez de silenciar.

3. **Reforçar visualmente que a ação se aplica a todos os contatos**
   - Manter rótulo "Trocar dono" no `BulkActionsBar` e adicionar tooltip: "Transfere o lead atual para outro responsável da BU".

4. **Validação com o Cleyton**
   - Login do Cleyton → BU Consórcio → CRM > **Contatos**.
   - Limpar filtros, selecionar leads de outros SDRs (Carol, etc.).
   - Clicar em "Trocar dono", escolher novo responsável e confirmar que o UPDATE persistiu (recarregar e checar coluna "Dono atual").

## Observações

- Não há alteração de RLS nem migration nova: as políticas atuais já permitem.
- A aba Negócios (Kanban) **não** será mexida nesta rodada, conforme pedido.
- Admin/Manager/Coordenador continuam com o comportamento atual.
