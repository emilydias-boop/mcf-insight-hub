# SEM_ATRIBUICAO agosto/2026 — checagem 1 feita, sua hipótese não se confirma

Só SELECT, nada alterado.

## 1) Dedup dos candidatos — resultado cru

Rodei os quatro caminhos de exclusão da perna B para os 11 cadastros (a busca por nome trouxe 17 linhas: 4 Daniel + 1 Thiago + 12 do Naufel, em duas grafias do nome). Resultado idêntico para **todas** as linhas:

- `proposal_id` preenchido (caminho 4): **true** em todas
- `consorcio_proposal_cartas.pending_registration_id` = id do cadastro (caminho 2): **true** em todas
- caminho 1 (`consorcio_proposals.consortium_card_id`): true só em `4fd447b2…` (Daniel); false nas demais
- caminho 3 (`consorcio_proposal_cartas.consortium_card_id`): false em todas

Ou seja: **os 6 do Naufel também são EXCLUÍDOS da perna B**, pelos caminhos 4 e 2 — não sobrevive nenhum dos 11. Então o R$ 720.000 da tela **não vem da perna B**. A coincidência 6 × 120.000 = 720.000 é real, mas esses registros entram por **perna A** (têm proposta aceita), e é lá que a cascata de closer precisa estar falhando — provavelmente porque o vendedor "Diego Carielo" não é closer da BU e a cascata A não usa nome, usa `created_by`/`owner_id`/reunião.

Isso invalida a parte da hipótese sobre a perna B, mas mantém em pé a sua leitura de que o balde é o Naufel — só que pela perna A.

## 2) e 3) — não determinei nesta rodada

Não rodei a cascata da perna A (`created_by → profiles.email → closers.email` → `crm_deals.owner_id` → closer da última reunião) nem a perna C, então não tenho o número do balde por perna nem o total consolidado. Não vou estimar: com a perna B agora zerada, qualquer soma que eu desse seria chute.

## Próximo passo proposto (ainda só SELECT)

1. Rodar a cascata completa da perna A para agosto/2026 e listar quem cai em `SEM_ATRIBUICAO`, dizendo em qual dos três elos cada registro quebra — confirmando se os 6 do Naufel (R$ 720.000) são exatamente esse conjunto.
2. Rodar a perna C (`tipo_registro='contratacao'` em agosto, sem cadastro e sem proposta, `nameKey(vendedor_name)` sem closer).
3. Fechar o total do balde com a precedência A > B > C e verificar se as 8 religações do Rodrigo mexeram nele (esperado: não, porque nem a perna A nem a B resolvem closer por `deal_id`; a perna A só usa `owner_id` do deal como 2º elo — este é o único ponto em que a religação poderia mudar algo, e vou testar exatamente isso).
4. Bônus: procurar `Diego Carielo` em `profiles` e em `closers` de qualquer BU, com e-mail e BU.

Confirma que eu sigo com esses quatro SELECTs?
