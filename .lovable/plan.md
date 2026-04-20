

## Diagnóstico final (testado via RPC com cutoff correto)

Rodei a RPC com os parâmetros que o front realmente envia e bateu com a tela:

| Tela | Valor | Origem |
|---|---|---|
| Carrinho R2 — "Aprovados" | **59** | `useR2CarrinhoKPIs` → conta `isAprovado(row)` em todos, **sem filtro de corte e sem filtro de status do attendee** |
| Relatório — "Aprovado" | **46** | `useContractLifecycleReport` → exige `situacao='realizada'` (= `attendee_status IN ('completed','contract_paid')`) **E** `dentroCorte=true` **E** status name = "Aprovado" |
| Relatório — "Aprovado (fora do corte)" | **10** | mesma regra mas `dentroCorte=false` |

### Por que diverge

1. **Filtro de corte**: KPI Carrinho R2 não aplica `dentro_corte` → soma os 49 dentro + 10 fora = **59**. Relatório aplica → mostra 49 e 10 separados (e dos 49, perde 3 que caem em "Próxima Semana"/"Sem status" → 46).
2. **Filtro de attendee_status**: KPI Carrinho R2 conta também `invited`, `scheduled`, `pre_scheduled` desde que o R2 esteja aprovado. Relatório só conta `completed`/`contract_paid` (porque a `situacao` precisa ser `realizada`).
3. **Sub-status em "Realizadas"**: Os 2 "Próxima Semana" e 1 "Sem status" no Relatório são leads aprovados com `r2_status_name` diferente (ou null), e o card "Aprovado" só pega os com nome literal "Aprovado".

Ou seja, **ambos consomem a mesma RPC, mas aplicam filtros diferentes em cima** — o nome "Aprovado" significa coisas diferentes nos dois lugares.

### Lista verdade do usuário = 44 leads

Mesmo o "49 dentro_corte" não bate com os 44 da safra real. Há 5 leads excedentes na cohort que não pertenciam à lista, e esses 5 foram identificados anteriormente (caso Helder/Alexandre DaLuz/etc. com contrato em 08/04 — que entram via `p_previous_cutoff = Sex 03/04 12:00`, regra ampla demais).

## Plano de correção

### 1. Alinhar Carrinho R2 KPI "Aprovados" com a regra do Relatório

Em `src/hooks/useR2CarrinhoKPIs.ts`, mudar a contagem de `aprovados` para respeitar `dentro_corte` (mesma regra do Relatório):

```ts
if (isAprovado(row) && row.dentro_corte) aprovados++;
```

E adicionar um novo KPI opcional `aprovadosForaCorte` para paridade visual com o Relatório.

Resultado esperado:
- "Aprovados" no Carrinho R2 cai de **59 → 49** (mesma base do Relatório dentro_corte)
- O painel Carrinho R2 ganha card "Fora do corte: 10" (igual ao Relatório)

### 2. Apertar a janela `p_previous_cutoff` para alinhar com a lista de 44

A regra atual usa `previousFriday = Qui_da_safra - 6 dias = Sex da semana ANTERIOR à safra`. Para safra Qui 09 → Qua 15, isso dá **Sex 03/04 12:00** — janela de 14 dias, ampla demais, inclui contratos de 03/04 a 08/04 que pertencem à safra anterior.

A janela operacional correta da safra Qui 09 → Qua 15 começa em **Sex 10/04 12:00** (a sexta DENTRO da safra, no horário do corte da safra anterior). Antes disso é a safra anterior.

**Correção em `src/lib/carrinhoWeekBoundaries.ts`** (linha 97):
```ts
// ANTES: const previousFriday = subDays(new Date(weekStart), 6);
// DEPOIS:
const previousFriday = addDays(new Date(weekStart), 1); // Sex da PRÓPRIA safra
```

Resultado esperado: contratos pagos de 03/04 a 09/04 antes das 12:00 caem em `dentro_corte = false` → KPI "Aprovado" cai de 49 → ~44 (alinhado com a lista oficial).

### 3. Validação

Após as mudanças:
- Carrinho R2 "Aprovados" = ~44 (igual à lista oficial)
- Carrinho R2 "Fora do corte" = ~15 (novo card)
- Relatório "Aprovado" = ~44 - 3 (próx semana/sem status) = ~41
- Relatório "Aprovado (fora do corte)" = ~15

### Escopo
- 1 alteração em `useR2CarrinhoKPIs.ts` (filtro `dentro_corte` + KPI extra)
- 1 alteração em `carrinhoWeekBoundaries.ts` (1 linha: `previousFriday`)
- 1 alteração em `R2Carrinho.tsx` (renderizar novo KPI "Fora do corte")
- Zero migration de banco — RPC já está correta

### Risco
A mudança em `previousFriday` afeta TODAS as semanas históricas (recálculo retroativo). Para semanas antigas o resultado pode mudar levemente. Recomendo testar primeiro na safra atual e na safra Qui 02 → Qua 08 (anterior) para ver impacto.

