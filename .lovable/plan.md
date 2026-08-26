# SEM_ATRIBUICAO em agosto/2026 — rodada parcial (só leitura)

Nada foi alterado. Confirmo a sua leitura da regra (pernas A/B/C e o `nameKey` primeiro|último sem acento) — não achei erro nela. Abaixo o que consegui apurar nesta rodada; o restante fica explicitamente pendente.

## (C) Closers da BU consórcio — lista crua

| id | name | email | is_active |
|---|---|---|---|
| `1472d772-a48b-4c88-ba07-398898532df4` | `Andre dos Santos Duarte` | andre.duarte@minhacasafinanciada.com | true |
| `4e3eabf5-149f-4130-ad8b-72fa929671f6` | `João Pedro Martins Vieira ` (espaço no fim) | joao.pedro@minhacasafinanciada.com | true |
| `ff13afd2-48b5-402f-bd14-9c2f047dc0ef` | `Luis Felipe de Souza Oliveira Ramos` | luis.felipe@minhacasafinanciada.com | true |
| `ce55f000-5bbb-4cc2-ae12-26368aff541f` | `Thobson` | thobson.motta@minhacasafinanciada.com | true |
| `e0b28a7d-b740-49a2-9005-80f72ee6bd9f` | `André de Castro França Nucci` | andre.nucci@minhacasafinanciada.com | false |
| `7eb4cbd8-e5dc-48b2-bc9c-7d8d23570be5` | `Jean\tCarlos Gonçalves Santos` (TAB no meio do nome) | jean.santos@minhacasafinanciada.com | false |
| `412f87de-3869-423e-9703-71125c29ea1c` | `Victoria Paz` | victoria.paz@minhacasafinanciada.com | false |

`nameKey` possíveis: `andre|duarte`, `joao|vieira`, `luis|ramos`, `thobson|thobson`, `andre|nucci`, `jean|santos` (o TAB pode alterar o split do primeiro nome), `victoria|paz`.

Dois pontos frágeis já visíveis: `Thobson` tem nome único (gera `thobson|thobson`) e `João Pedro Martins Vieira ` tem espaço final — a chave depende de o código dar `trim()` antes do split.

## (A) parcial — perna B, cadastros de agosto que não casam com nenhum closer

Rodei a comparação de `nameKey` da perna B (âncora `aceite_date` em agosto, cadastros não excluídos). Registros que falham:

| perna | id | cliente | âncora | crédito | vendedor (campo) | nameKey do vendedor | deal_id | por que falhou |
|---|---|---|---|---|---|---|---|---|
| B | `ce86896d…` | Daniel Alves Martins | 22/08 | 150.000 | **nulo** (`vendedor_name` e `vendedor_name_cota` vazios) | — | `a644c6c8…` | vendedor não gravado: não há string para comparar |
| B | `6cf100c7…` | Daniel Alves Martins | 22/08 | 150.000 | nulo | — | `a644c6c8…` | idem |
| B | `21dda284…` | Daniel Alves Martins | 22/08 | 150.000 | nulo | — | `a644c6c8…` | idem |
| B | `4fd447b2…` | Daniel Alves Martins | 22/08 | 150.000 | nulo | — | `a644c6c8…` | idem |
| B | `808473fd…` | THIAGO FELIPE FAUSTINO | 22/08 | 150.000 | nulo | — | `d77e2eb3…` | idem |
| B | `b093e7dd…` | NAUFEL RACHED MOHAMOUD ALI | 25/08 | 120.000 | `Diego Carielo` (`vendedor_name_cota`) | `diego\|carielo` | `6b8f182a…` | não existe closer na BU consórcio com esse nameKey (comparado contra os 7 da tabela acima) |
| B | `4c889b3d…` | NAUFEL RACHED MOHAMOUD ALI | 25/08 | 120.000 | `Diego Carielo` | `diego\|carielo` | `6b8f182a…` | idem |
| B | `d926fbfb…` | NAUFEL RACHED MOHAMOUD ALI | 25/08 | 120.000 | `Diego Carielo` | `diego\|carielo` | `6b8f182a…` | idem |
| B | `8e50aaff…` | NAUFEL RACHED MOHAMOUD ALI | 25/08 | 120.000 | `Diego Carielo` | `diego\|carielo` | `6b8f182a…` | idem |
| B | `99c7f1cf…` | NAUFEL RACHED MOHAMOUD ALI | 25/08 | 120.000 | `Diego Carielo` | `diego\|carielo` | `6b8f182a…` | idem |
| B | `9ddc05e4…` | NAUFEL RACHED MOHAMOUD ALI | 25/08 | 120.000 | `Diego Carielo` | `diego\|carielo` | `6b8f182a…` | idem |

Soma desta fatia: 5 × 150.000 + 6 × 120.000 = **R$ 1.470.000** em 11 registros — mas **isto não é o número da tela**: minha consulta não aplicou a precedência das pernas (registros com proposta aceita pertencem à perna A e podem estar resolvidos por lá) nem o corte de duplicidade que o hook faz. Tratar como candidatos da perna B, não como o balde final.

## (D) caminho de correção, por caso

- **Daniel Alves Martins (4 cadastros) e THIAGO FELIPE FAUSTINO (1)** — vendedor em branco: não há tela que peça "vendedor" nesse resíduo; a correção é no dado do cadastro/cota no Controle Consórcio, gravando o vendedor. "Trocar lead" não resolve, porque a perna B não olha o deal.
- **NAUFEL RACHED MOHAMOUD ALI (6 cadastros, vendedor "Diego Carielo")** — o vendedor existe como pessoa, mas não como closer da BU consórcio. Duas saídas, ambas no dado: cadastrar/ativar Diego Carielo em `closers` com `bu='consorcio'` e e-mail, ou corrigir o vendedor da cota para o closer que realmente conduziu. Não existe tela que atribua closer nesse resíduo.

## Pendente (não determinei)

- Perna A: não rodei a cascata `created_by → profiles.email → closers.email` → `crm_deals.owner_id` → closer da reunião, então não sei quais registros de proposta aceita caem no balde nem qual elo quebra em cada um.
- Perna C: não rodei os cards sem cadastro e sem proposta.
- (B): o total novo do balde depois das 8 religações do Rodrigo. Sem as pernas A e C e sem a precedência entre pernas, qualquer número que eu desse aqui seria errado. O antigo que você viu na tela era R$ 720.000.

Quer que eu siga daqui rodando perna A e perna C com a precedência correta, para fechar (A) e (B)?
