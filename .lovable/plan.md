## Objetivo
Permitir que o SDR Cleyton use a ação "Trocar dono" nos deals da BU Consórcio.

## Como funciona hoje
Existe a flag `profiles.can_transfer_leads` (memória `contacts-transfer-capability`). Quando ativada para um SDR/Closer, libera o botão "Trocar dono" em CRM > Contatos (via `BulkTransferDialog` + `OwnerChangeDialog`). Admin/Manager/Coordenador já têm acesso por padrão.

## Passos
1. Localizar o profile do SDR Cleyton em `profiles` (busca por `full_name ILIKE '%cleyton%'` com role `sdr`) para confirmar o `id` e evitar ativar para o usuário errado.
2. Rodar um UPDATE em `profiles` setando `can_transfer_leads = true` apenas para o `id` do Cleyton.
3. Pedir para o Cleyton recarregar a página — o hook `useMyContactsCapabilities` revalida e o botão "Trocar dono" aparece em CRM > Contatos (acessível dentro da BU Consórcio também, pois a capability é global por usuário).

## Observação de escopo
A flag `can_transfer_leads` hoje é global (não é por BU). Cleyton poderá usar "Trocar dono" em qualquer BU onde enxergue contatos — não apenas Consórcio. Se você quiser restringir estritamente à BU Consórcio, isso exigiria uma alteração de schema/lógica (nova coluna/tabela por BU) — me avise se for o caso, senão sigo com o toggle global existente.
