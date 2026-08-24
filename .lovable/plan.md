# Produção Gerada — medição de agosto/2026 e recomendação

Investigação só. Nada de código, migração ou dado tocado.

## Veredito curto

Sua proposta (união de duas pernas, deduplicada, cada venda contada uma única vez na primeira aparição) **se sustenta no dado** — com uma correção importante: hoje o funil é praticamente irrelevante em volume. Em agosto, **56 das 57 cotas contratadas não têm proposta nenhuma vinculada**. A perna B não é um resíduo: é 74% do número. A tese "a perna B vai a zero sozinha" continua válida como desenho, mas só se o funil virar porta de entrada de verdade em setembro — hoje ele não é.

A consequência que você previu **se confirma**: Produção Gerada (R$ 13,52 mi) > Consórcio Efetivado (R$ 10,18 mi). Formato saudável.

## Os números de agosto/2026

### 1. Perna A isolada — cartas de propostas lançadas (status `aceita`, etapa 3 em diante), âncora `aceite_date` (fallback `proposal_date`)

| Closer | Vendas | Cartas | Crédito |
|---|---|---|---|
| João Pedro Martins Vieira | 4 | 9 | R$ 2.290.000 |
| Andre dos Santos Duarte | 3 | 3 | R$ 1.200.000 |
| **Total** | **7** | **12** | **R$ 3.490.000** |

Contexto histórico: 100 propostas `aceita` no total (fev–ago), 90 `pendente`, 17 `recusada`. 177 cartas na base, **0 declinadas até hoje**.

### 2. Perna B isolada — cotas sem proposta nenhuma, por data candidata

| Âncora | Cotas | Crédito |
|---|---|---|
| `created_at` | 62 | R$ 11.162.195 |
| `data_contratacao` | 56 | R$ 10.030.000 |
| `data_reserva` | 40 | R$ 6.810.000 |

Por vendedor (`vendedor_name`):

| Vendedor | contratação (n / R$) | created_at (n / R$) | reserva (n / R$) |
|---|---|---|---|
| Joao Pedro Martins Vieira | 44 / 7.750.000 | 45 / 7.870.000 | 29 / 4.680.000 |
| André Duarte | 12 / 2.280.000 | 15 / 3.120.000 | 11 / 2.130.000 |
| Luis Felipe S. O. Ramos | 0 | 1 / 52.195 | 0 |
| Victoria Paz | 0 | 1 / 120.000 | 0 |

**Qual data eu defendo: `data_contratacao`, com fallback `data_reserva` e só então `created_at`.** Razões: (a) é a mesma âncora do Consórcio Efetivado, então as duas colunas ficam comparáveis lado a lado na mesma linha; (b) `created_at` é data de digitação — o cadastro pode entrar semanas depois e joga produção no mês errado (é ela que traz os 6 cotas/R$ 1,1 mi extras, incluindo dois vendedores que não aparecem por contratação); (c) `data_reserva` está preenchida em só 40 das 62 cotas, buraco grande demais para ser âncora primária.

### 3. União deduplicada — o que a coluna mostraria hoje

Com âncora `data_contratacao` na perna B:

| Closer | Perna A | Perna B | **Produção Gerada** |
|---|---|---|---|
| João Pedro | 2.290.000 | 7.750.000 | **R$ 10.040.000** |
| André | 1.200.000 | 2.280.000 | **R$ 3.480.000** |
| **Total** | 3.490.000 | 10.030.000 | **R$ 13.520.000** |

Com `created_at` na perna B seriam R$ 14.652.195 (JP 10,16 mi; André 4,32 mi; + Luis 52.195; + Victoria 120.000).

### 4. Comparação com as colunas existentes

| Métrica | Valor |
|---|---|
| Consórcio Efetivado (total) | R$ 10.180.000 (JP 7.750.000 · André 2.430.000) |
| Cotas Contratadas | 57 |
| Produção Gerada (proposta) | R$ 13.520.000 |

Produção Gerada é **33% maior** que o Efetivado — direção correta. Note que o Efetivado do João Pedro (7,75 mi) é **exatamente** a perna B dele: nenhuma cota dele em agosto veio do funil. Já o André tem R$ 150.000 de diferença (2,43 mi Efetivado vs 2,28 mi perna B) — é a única cota de agosto vinculada a proposta, corretamente removida da perna B pelo dedup.

### 5. Cotas de agosto sem proposta vinculada

**56 de 57 cotas (98%), somando R$ 10.030.000.** Na base inteira só 51 cotas (de 1.780) têm qualquer vínculo com proposta.

## Dedup: qual vínculo usar

Os três caminhos, na base inteira:

- `consorcio_proposals.consortium_card_id` → 51
- `consorcio_proposal_cartas.consortium_card_id` → 51
- `consorcio_proposal_cartas.pending_registration_id` → `consorcio_pending_registrations.consortium_card_id` → 1

**Use a UNIÃO dos três.** Há exatamente **1 cota vinculada só pelo caminho do cadastro pendente** e não pelo `consortium_card_id` da carta. Um só caminho perde essa cota e ela seria contada duas vezes. Custo de usar os três é zero.

## Decisões que precisam da sua palavra

### A. Carta declinada / desistência conta?

- **Contar (leitura do dono):** "o closer gerou" é o que ele disse; simples de explicar; a coluna nunca diminui retroativamente. Contra: um mês com muita desistência infla a produção sem lastro nenhum.
- **Não contar:** aproxima a coluna de receita futura. Contra: contradiz a definição dele e faz a coluna encolher no retrovisor, exatamente o que o Efetivado já faz.

**Como distinguir declínio de exclusão em código** — os campos existem e são distintos:
- Declínio da carta: `consorcio_proposal_cartas.declinada_at` / `motivo_declinio` / `declinada_by`. Hoje: **0 registros**.
- Proposta apagada por engano: `consorcio_proposals.deleted_at` (hoje 0) e `carta_excluida` + `carta_excluida_em/por/motivo` (hoje 2 propostas, 1 `aceita` e 1 `recusada`).

Recomendo: **contar declinadas, excluir sempre `deleted_at is not null` e `carta_excluida = true`.** A distinção é limpa e não depende de heurística.

### B. Atribuição ao closer

**Perna A** — encadeamento `proposals.created_by` → `profiles.email` → `closers.email`. Funciona, com dois furos reais medidos:
1. **João Pedro tem DUAS linhas em `closers`** com o mesmo e-mail (uma `is_active=false`). Um join ingênuo por e-mail **duplica a produção dele**. Tem que colapsar por e-mail e preferir a linha ativa.
2. **`created_by` nem sempre é o closer.** 2 propostas `aceita` foram criadas pelo Antony (equipe de cadastro), que não tem linha em `closers` → produção órfã. Precisa do fallback: dono do deal → closer da reunião.

**Perna B** — `consortium_cards.vendedor_name`, o mesmo que a coluna atual usa (via `nameKey` normalizado em `useConsorcioCotasContratadas.ts`). Consistente, mas os nomes divergem entre as pernas ("Joao Pedro Martins Vieira" na cota vs "João Pedro Martins Vieira " no perfil, com acento e espaço final). A normalização por NFD/caixa alta que o hook já faz resolve; a chave final de merge tem que ser **o `closer_id`**, nunca a string.

### C. Consequência a aceitar

Confirmado com dado: **Produção Gerada > Consórcio Efetivado** (13,52 vs 10,18 mi). Não deu o contrário — a definição está de pé. Duas coisas que o dono precisa aceitar junto:
- A coluna **conta a venda no mês em que ela apareceu**, então uma cota lançada em julho e contratada em agosto aparece na Produção de julho e no Efetivado de agosto. Meses não fecham entre si por construção.
- **Ticket Médio não muda**: ele é derivado de Cotas Contratadas, que continua intacta. Mas ter três valores de crédito na mesma tabela (Gerada, Efetivado, Ticket) exige tooltip em cada um.

## Recomendação de desenho (se aprovada, vira implementação numa próxima rodada)

Um hook novo `useConsorcioProducaoGerada(start, end)` que devolve `Map<closerId, { credito, cartas, vendas }>`, com as duas pernas e o dedup pelos três vínculos, âncora `data_contratacao` → `data_reserva` → `created_at` na perna B. A coluna entra entre *Vendas Realizadas* e *Cotas Contratadas* em `ConsorcioCloserSummaryTable.tsx`, com tooltip declarando: "soma o crédito de todas as vendas lançadas (termo pendente em diante), contando cada venda uma vez; inclui vendas que ainda não se efetivaram". Nada nas colunas existentes é tocado.

**Sobre setembro:** o desenho está certo, mas a premissa não está cumprida. Se em setembro os closers continuarem lançando cota direto sem passar por proposta, a perna B não vai a zero e a coluna vira permanentemente uma soma de duas portas. Vale medir isso em outubro: se a perna B não cair, o problema é de processo, não de métrica.
