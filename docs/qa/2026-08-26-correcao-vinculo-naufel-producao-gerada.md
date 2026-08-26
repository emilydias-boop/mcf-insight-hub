# Correção de vínculo — Naufel Rached Mohamoud Ali (Produção Gerada, ago/2026)

Data: 26/08/2026. Escrita pontual e nominal, autorizada pelo dono. Escopo fechado: apenas o cliente Naufel Rached Mohamoud Ali, CPF 002.549.012-55.

## O que estava errado

A proposta `89a6f11b-704e-4de4-9a1b-3138c9cb8dc5` (6 cartas, R$ 720.000, aceite em 25/08/2026) foi lançada apontando para o lead `6b8f182a-6506-4bf9-9642-a7dd903d7169` — um lead vazio, sem dono e sem reunião, criado em 25/08 21:33 pelo fluxo "Adicionar carta" (`AddCartaModal` cria lead novo sem consultar a agenda). Os 6 cadastros em `consorcio_pending_registrations` (status `aguardando_abertura`) apontavam para esse mesmo lead, com vendedor "Diego Carielo" — nome que não existe em `closers` da BU Consórcio.

Efeito: na perna A do `useConsorcioProducaoGerada`, os três elos de atribuição falhavam (criador não é closer da BU; lead sem dono; lead sem reunião) e os R$ 720.000 caíam no balde "Produção sem atribuição".

## Evidência do destino correto

- Lead correto: `9f74d159-8b21-4b2e-94ce-a81a39f7fa10` ("Naufel Rached ali - A010"), dono `andre.duarte@minhacasafinanciada.com`, contato com telefone (61) 99220-1331 e e-mail naufell@gmail.com.
- R1 de consórcio em 24/08/2026 às 16:00, closer **Andre dos Santos Duarte**, status `completed`.
- Agendada por **Cleiton Anacleto Lima** (`booked_by`).
- Cadastros irmãos já existentes nesse lead usam `vendedor_name_cota = 'Andre dos Santos Duarte'` (vendedor_id nulo).

## O que foi escrito

1. `consorcio_proposals.deal_id` da proposta `89a6f11b…`: `6b8f182a…` → `9f74d159…`.
2. `consorcio_pending_registrations.deal_id` dos 6 cadastros do Naufel: `6b8f182a…` → `9f74d159…` (confirmado antes que o lead errado só tinha cadastros do Naufel).
3. Vendedor dos mesmos 6 cadastros igualado ao cadastro irmão: `vendedor_name_cota='Andre dos Santos Duarte'`, `vendedor_name=null`, `vendedor_id=null`. (A opção de catálogo mais próxima em `consorcio_vendedor_options` é "André Duarte", id `3915d4be-ba62-4bf8-9653-b4c00a97a743`, nome diverso — não foi usada para não inventar vínculo.)
4. Auditoria manual em `audit_logs`: action `proposta_vinculo_corrigido`, `record_id` = proposta, old/new data com deal anterior/novo, motivo e `cadastros_movidos=6`.

Verificação pós-escrita: 0 cadastros restantes no lead errado; proposta e 12 cadastros do cliente no lead correto; trigger `trg_audit_pending_deal_link` registrou `deal_vinculo_anterior` nos 6 cadastros movidos.

## Por que não houve caminho pela interface

- Nenhuma tela edita `consorcio_proposals.deal_id` (varredura em `src/`: nenhum update nessa coluna; `EditProposalModal`/`CartasProposalEditor` não têm campo de lead).
- A RPC `consorcio_corrigir_vinculo_cota` (botão "Trocar lead") exige `p_card_id` de `consortium_cards` e só escreve em `consorcio_pending_registrations` — os cadastros estavam em `aguardando_abertura`, sem cota contratada, logo sem card para invocá-la.
- O alerta "Cotas com cadastro a ajustar" nasce de `consortium_cards` com `tipo_registro='contratacao'`; cadastros sem card não aparecem em nenhum alerta com ação de correção.

## Ressalva de autoria

A escrita foi feita fora de sessão autenticada (SQL direto), portanto `user_id` do `audit_logs` e `deal_vinculo_ajustado_por` ficaram **nulos**. O rastro nominal está no payload `new_data.autor = 'correcao_manual_sem_sessao_autenticada'` e neste documento.

## Fora de escopo (não tocado)

Leads órfãos `53398afa…`, `cb15125a…` e `6b8f182a…` permanecem como estão. Nenhum DELETE, nenhum backfill, nenhum outro cliente alterado.
