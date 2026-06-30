## Diagnóstico — Tela de Vendas BU Incorporador

Foi identificada uma **causa-raiz comum** aos dois casos. Não é regra de família funcionando "como projetado": é um **bug de duplicidade na ingestão Hubla** que está envenenando o `firstIdSet`.

---

### Padrão encontrado no banco

A Hubla envia, para cada fatura, **2 grupos de eventos**:

1. **Eventos `newsale-*`** (1 por produto da fatura): chegam ~0,4s **antes**, têm `net_value = 0`, `product_price` igual ao valor total da fatura (não ao preço unitário) e `hubla_id = newsale-<timestamp>`.
2. **Eventos da fatura real** (principal + `-offer-N` para cada bump): chegam ~0,4s depois, com `net_value` real e `hubla_id` no formato UUID / `UUID-offer-N`.

Existem hoje **8.457 linhas `newsale-*`** na base, **8.364 com `net_value = 0`**. Todas com `source = 'hubla'` — portanto entram no `ranked_transactions` da RPC `get_first_transaction_ids` e, por chegarem primeiro, **ganham o ranking e ocupam a vaga de "primeira compra" da família** para aquele cliente.

Resultado: a transação real da mesma família é classificada como duplicata e tem o bruto zerado.

---

### PONTO 1 — Antonio Edson (edsonsous@outlook.com)

**Antonio não tem nenhuma compra anterior de A010.** Todas as linhas dele são da mesma fatura de 30/06/2026 19:55:01 UTC.

Fatura real (`hubla_id` base `a8064137-9bda-4257-b58a-827432556d2d`):

| Papel | hubla_id | product_name | price | net |
|---|---|---|---|---|
| Principal | `a8064137-…` | Construir Para Alugar | 144 | 85,63 |
| Bump 1 | `a8064137-…-offer-1` | A010 - Consultoria… | 47 | 27,94 |
| Bump 2 | `a8064137-…-offer-2` | Construir Para Alugar | 97 | 57,68 |

Observação: o **principal real é "Construir Para Alugar"**, não A010 (o A010 é o bump). A leitura visual da tela parece estar invertida.

Linhas-fantasma `newsale-*` da mesma fatura (chegam 0,455s antes, net = 0):

| hubla_id | product_name | price | net | sale_date |
|---|---|---|---|---|
| `newsale-1782849895173` | A010 - Consultoria… | **144** | 0 | 19:55:01.103 |
| `newsale-1782849894222` | Construir Para Alugar | 144 | 0 | 19:55:01.108 |

**Por que o bump A010 aparece como (dup):** a RPC `get_first_transaction_ids` rankeia por `sale_date ASC`. A linha `newsale-1782849895173` (A010, fantasma) entra no `firstIdSet` em 19:55:01.103. O bump real `a8064137-…-offer-1` (A010) só chega em 19:55:01.558 e perde o ranking → bruto zerado por regra de deduplicação por família, mesmo sendo a primeira compra real do Antonio.

---

### PONTO 2 — Caio Roth (caio.roth@gmail.com)

A fatura real do Caio (`hubla_id` base `8049682c-7593-4ef1-98a7-52a64811dd1f`) tem **principal A010 + 3 bumps** (não Planilha como principal — a Planilha é o `offer-1`):

| Papel | hubla_id | product_name | price | net |
|---|---|---|---|---|
| Principal | `8049682c-…` | A010 - Consultoria… | 113,90 | 103,68 |
| Bump 1 | `…-offer-1` | Planilha de Viabilidade | 19,90 | 18,11 |
| Bump 2 | `…-offer-2` | Construir MCMV… | 47 | 42,78 |
| Bump 3 | `…-offer-3` | A010 - Consultoria… | 47 | 42,78 |

Ou seja: **a fatura tem 4 produtos, não 3.** A tela mostrando 3 linhas já indica que uma linha sumiu do agrupamento (provavelmente o `offer-3` A010, suprimido como duplicata da família junto com o principal).

Linhas-fantasma `newsale-*` (chegam 0,335s antes, net = 0):

| hubla_id | product_name | price | net | sale_date |
|---|---|---|---|---|
| `newsale-1782838606829` | Planilha de Viabilidade | 113,90 | 0 | 16:56:17.458 |
| `newsale-1782838607291` | Construir MCMV… | 113,90 | 0 | 16:56:17.463 |
| `newsale-1782838606539` | A010 - Consultoria… | 113,90 | 0 | 16:56:17.467 |

**Efeito da deduplicação:**

- Família A010: `newsale-…606539` ganha o `firstIdSet`. O principal real A010 (113,90) e o bump A010 (47) são marcados como duplicatas → ambos com bruto zerado.
- Família Planilha: `newsale-…606829` ganha. O bump Planilha (19,90) vira duplicata → bruto zerado.
- Família MCMV: `newsale-…607291` ganha. O bump MCMV (47) vira duplicata → bruto zerado.

**Resultado prático:** a fatura real do Caio (4 produtos, ~227 brutos) está aparecendo zerada na tela porque os 3 fantasmas `newsale-*` (todos net=0) "consumiram" a posição de primeira compra de cada família.

Sobre o agrupamento de carrinho: o agrupamento por `hubla_id` raiz (`8049682c-…`) está correto e cobre os 4 produtos reais. O problema é que os fantasmas `newsale-*` aparecem em **outro `hubla_id`** (não compartilham o UUID base), então **não entram no mesmo grupo de carrinho** — ficam como linhas soltas e/ou desaparecem do display, mas continuam envenenando o ranking de família.

---

### Resumo da causa-raiz (válido para os dois pontos)

A regra de deduplicação por família está funcionando exatamente como projetada. **O problema é a fonte:** a Hubla está gravando, para toda fatura, 1 linha `newsale-<timestamp>` por produto, ~0,4s antes da fatura real, com `net_value = 0`, `product_price` inflado (valor total da fatura) e `hubla_id` em formato diferente. Essas linhas:

1. São aceitas como `source = 'hubla'` válidas pela RPC `get_first_transaction_ids`.
2. Ganham o ranking `ORDER BY sale_date ASC` por chegarem primeiro.
3. Roubam a vaga de "primeira compra" da família para aquele cliente+produto.
4. Fazem a transação real (principal e/ou bump) ser marcada como duplicata e ter o bruto zerado.

**Impacto na base:** 8.364 linhas-fantasma `newsale-*` com `net = 0` ativas hoje (todas envenenando ranking de família).

Aguardando seu OK para apresentar opções de correção (ex.: excluir `hubla_id LIKE 'newsale-%'` do `ranked_transactions`, ou despriorizá-las no `ORDER BY` para que sempre fiquem atrás da fatura real do mesmo cliente+família).