# SEM_ATRIBUICAO agosto/2026 — o que fechei e o que não fechei

Só SELECT. Nada foi alterado. Vou ser direto sobre o limite: **não terminei os quatro SELECTs**. Fechei só a checagem (1). A perna A ficou incompleta por erro de coluna e o tempo acabou antes de eu reescrever a consulta.

## (1) Dedup — FECHADO, e sua hipótese não se confirma

Rodei os quatro caminhos de exclusão da perna B nos cadastros de agosto (busca por nome trouxe 17 linhas: 4 Daniel + 1 Thiago + 12 do Naufel, em duas grafias). Resultado idêntico em **todas** as linhas:

| caminho | resultado |
|---|---|
| 4 — `proposal_id` preenchido | **true em todas as 17** |
| 2 — `consorcio_proposal_cartas.pending_registration_id` = id do cadastro | **true em todas as 17** |
| 1 — card em `consorcio_proposals.consortium_card_id` | true só em `4fd447b2…` (Daniel); false nas outras |
| 3 — card em `consorcio_proposal_cartas.consortium_card_id` | false em todas |

Conclusão: **nenhum dos 11 sobrevive à perna B** — os 6 do Naufel também são excluídos, pelos caminhos 4 e 2. Logo o R$ 720.000 da tela **não sai da perna B**. A igualdade 6 × 120.000 = 720.000 é coincidência aritmética verdadeira, mas esses registros entram pela **perna A** (têm proposta aceita). Se o balde é o Naufel, é lá que a cascata `created_by → owner_id → closer da reunião` quebra — e a perna A não olha `vendedor_name`, então o "Diego Carielo" não é a causa direta, só o sintoma.

Não determinei se o conjunto do balde é exatamente esses 6.

## (2) perna A — NÃO determinei

A consulta da cascata falhou em `consorcio_proposal_cartas.titular_nome` (coluna não existe) e não refiz. Sem ela não tenho a tabela por registro nem qual dos três elos quebra.

## (3) total do balde, (4) perna C, bônus Diego Carielo — NÃO determinei

Não cheguei a rodar.

## Retomada — exatamente o que rodar

1. Ler as colunas reais de `consorcio_proposal_cartas` (`information_schema.columns`) antes de reescrever — foi o que me derrubou.
2. Perna A: propostas com `status='aceita'` e âncora `coalesce(aceite_date, proposal_date)` em agosto; para cada uma, resolver `created_by → profiles.email → closers.email (bu='consorcio')`, depois `crm_deals.owner_id` (valor cru, guarda e-mail) contra `closers.email`, depois closer da última reunião do deal via `meeting_slot_attendees → meeting_slots → closers`. Listar as que falham nos três, com `proposal_id`, `deal_id`, nome do deal, âncora, soma de crédito das cartas, nº de cartas e o motivo de cada elo.
3. Confirmar por número se são os 6 do Naufel / R$ 720.000 ou outro conjunto.
4. Perna C: cards `tipo_registro='contratacao'` em agosto, sem cadastro e sem proposta, `nameKey(vendedor_name)` sem closer da BU.
5. Total do balde com precedência A > B > C, e checar se as 8 religações do Rodrigo mexem nele (só poderiam via elo 2 da perna A, `owner_id`).
6. `Diego Carielo` em `profiles` e em `closers` de qualquer BU, com e-mail e BU.

Aprove que eu sigo daqui e devolvo tudo de uma vez, sem parar no meio.
