# SEM_ATRIBUICAO agosto/2026 — entrega parcial, com o que ficou de fora

Só SELECT. Nada foi alterado. Aviso primeiro: **fechei apenas os passos 1 e a leitura de colunas**. Os itens 1 a 5 do seu "resultado mínimo" não foram entregues nesta rodada — a sessão foi encerrada antes. Abaixo o que ficou provado e o SQL pronto para a próxima rodada rodar direto, sem tentativa e erro.

## Provado: a dedup derruba a hipótese da perna B

Os quatro caminhos de exclusão da perna B nos cadastros de agosto (17 linhas: 4 Daniel + 1 Thiago + 12 Naufel em duas grafias):

| caminho | resultado |
|---|---|
| 4 — `proposal_id` preenchido | true em todas as 17 |
| 2 — `consorcio_proposal_cartas.pending_registration_id` = id do cadastro | true em todas as 17 |
| 1 — card em `consorcio_proposals.consortium_card_id` | true só em `4fd447b2…` (Daniel) |
| 3 — card em `consorcio_proposal_cartas.consortium_card_id` | false em todas |

**Nenhum dos 11 sobrevive à perna B** — inclusive os 6 do Naufel. Então o R$ 720.000 da tela não sai da perna B; a igualdade 6 × 120.000 é coincidência. Esses registros entram pela **perna A**, e é a cascata `created_by → owner_id → closer da reunião` que precisa estar quebrando. Como a perna A não lê `vendedor_name`, o "Diego Carielo" é sintoma, não causa.

## Colunas confirmadas (fim do chute)

- `consorcio_proposal_cartas`: `id, proposal_id, ordem, valor_credito, prazo_meses, tipo_produto, pending_registration_id, consortium_card_id, created_at, created_by, parcelas_mcf, parcela_1a_12a, parcela_demais, condicao_pagamento, objetivo, categoria, declinada_at, motivo_declinio, declinada_by` — **não existe nome de titular**, confirmando sua instrução (b): usar `crm_deals.name`.
- `consorcio_proposals`: tem `deal_id, created_by, proposal_date, aceite_date, aceite_by, status, valor_credito, consortium_card_id, qtd_cartas, deleted_at, carta_excluida`. Atenção para a próxima rodada: filtrar `deleted_at is null` e considerar `carta_excluida`, que eu não tinha previsto.

## Ficou de fora (todos os 5 itens do mínimo)

1. Lista da perna A com o elo quebrado — não determinei.
2. Total do balde com precedência A > B > C — não determinei.
3. Se o conjunto é os 6 do Naufel / R$ 720.000 — não determinei (mas já sei que não é via perna B).
4. `Diego Carielo` em `profiles`/`closers` — não determinei.
5. Perna C — não determinei.

## Próxima rodada: SQL a executar, nesta ordem

1. **Perna A**: propostas com `status='aceita'`, `deleted_at is null`, âncora `coalesce(aceite_date, proposal_date)` em agosto/2026; juntar cartas por `proposal_id` (soma `valor_credito`, contagem) e `crm_deals` por `deal_id` para o nome. Para cada uma resolver, em ordem: (i) `created_by → profiles.email → closers.email` com `bu='consorcio'`; (ii) `crm_deals.owner_id` cru contra `closers.email`; (iii) closer da última reunião via `meeting_slot_attendees → meeting_slots → closers`. Filtrar as que falham nos três e imprimir o motivo de cada elo.
2. **Item 3**: somar essa lista e comparar com 6 / R$ 720.000.
3. **Diego Carielo**: `profiles` por nome, e `closers` em qualquer BU, retornando e-mail e `bu`.
4. **Perna C**: cards `tipo_registro='contratacao'` em agosto sem cadastro e sem proposta, com `nameKey(vendedor_name)` sem closer da BU.
5. **Total** com precedência A > B > C, e checar se as 8 religações do Rodrigo mexem no número (só poderiam pelo elo (ii), `owner_id`).

Aprove para eu rodar esses cinco de uma vez.
