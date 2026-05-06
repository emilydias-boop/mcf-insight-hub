
# Correção: parceiros e cutoff em "Semanas Anteriores" (R2 Carrinho)

## Contexto da divergência

Na safra ativa (Qui 30/04 → Qua 06/05), o card **"Semanas Anteriores"** mostra 11–12 leads, mas a soma real válida é **5**. Investigação no banco revelou dois bugs combinados que afetam todos os sub-cards (`↩ X de sem. anteriores`).

**Caso emblemático — Emerson Aguiar:**
- Comprou A001 (parceria) em 04/05 → deveria ser excluído de TODAS as métricas (regra core do projeto).
- Contrato pago Qui 30/04 11:30 BRT — mesma quinta da safra atual, não veio de semana anterior.

## Bugs identificados

### Bug 1 — Filtro de parceiros não aplicado nos KPIs operacionais

A regra core diz: "Partner/renewal products A001-A009, R001, INCORPORADOR são excluídos de métricas". Hoje em `useR2CarrinhoKPIs.ts`:
- ✅ `contratosPagos` exclui parceiros (constrói `partnerEmails` e filtra)
- ❌ `r2Realizadas`, `r2Agendadas`, `noShowR2`, `aprovados`, `semanasAnteriores`, `pendentes`, `desistentes`, `foraDoCarrinho` — **nenhum** aplica esse filtro

O `Set<partnerEmails>` precisa ser propagado e cruzado com `unifiedData` no loop principal.

### Bug 2 — Cutoff errado para "semana anterior"

Hoje:
```ts
if (contractTs < prevCutoffTs) semanasAnteriores++;
```
Onde `prevCutoffTs` = Sex 12:00 da semana anterior. Resultado: contratos pagos de **Qui 00:00 até Sex 12:00 da própria safra** são falsamente classificados como "semana anterior".

Correto:
```ts
const safraStartTs = boundaries.contratos.start.getTime(); // Qui 00:00
if (contractTs < safraStartTs) semanasAnteriores++;
```

## Distribuição real após correção (12 → 5)

| Lead | Contrato | Status atual | Após correção |
|---|---|---|---|
| Emerson Aguiar | 30/04 | Sem.Ant. Realizada | **Removido (parceiro)** |
| Cláudio Márcio, Maria Isabel, Victor, Claudio Almeida, Giovana | 30/04 (Qui) | Sem.Ant. Realizada | **Removido (mesma safra)** |
| Roberto Cezar | 30/04 (Qui) | Sem.Ant. Agendada | **Removido (mesma safra)** |
| Paulo Henrique | 29/04 | Sem.Ant. Realizada | Mantém ✓ |
| Mateus Pacheco | 28/04 | Sem.Ant. Realizada | Mantém ✓ |
| Bruno Cesar | 27/04 | Sem.Ant. No-Show | Mantém ✓ |
| Alexandre Donizete | 27/04 | (órfão) | Mantém ✓ |
| Alexsandro Moreira | 07/04 | Sem.Ant. Agendada | Mantém ✓ |

**Total esperado pós-correção: 5 leads** (4 verdadeiramente "anteriores" + 1 órfão Alexandre)
- Sem.Ant. Realizadas: 2 (Paulo, Mateus)
- Sem.Ant. No-Show: 1 (Bruno)
- Sem.Ant. Agendadas: 1 (Alexsandro)
- Sem.Ant. Outros: 1 (Alexandre — `attendee_status='rescheduled'`)

# Plano de implementação

## 1. `src/hooks/useR2CarrinhoKPIs.ts`

**Refatorar para que o filtro de parceiros e o filtro de safra-start se apliquem a todos os KPIs derivados de `unifiedData`:**

a) Mover a construção de `partnerEmails` da `queryFn` interna para fora, ou expor `partnerEmails` (e `refundEmails`) no retorno do `useQuery` `r2-carrinho-contratos` (já está `data: contratosData`).

b) Adicionar `partnerEmails: Set<string>` ao retorno de `contratosData`.

c) No loop principal `for (const row of unifiedData)`:
   - Calcular `email = (row.contact_email || '').toLowerCase().trim()`
   - Se `partnerEmails.has(email)` → `continue` (pula o lead inteiro de TODOS os sub-contadores)

d) Trocar comparação de "semana anterior":
   ```ts
   const safraStartTs = boundaries.contratos.start.getTime();
   if (contractTs < safraStartTs) { semanasAnteriores++; ... }
   ```
   (em vez de `prevCutoffTs`)

e) Adicionar `semanasAnterioresOutros` para o caso "órfão" (lead em `semanasAnteriores` mas que não cai em nenhum dos 4 buckets — ex.: `attendee_status='rescheduled'`):
   ```ts
   if (isRealizada(row)) semanasAnterioresRealizadas++;
   else if (isNoShow) semanasAnterioresNoShow++;
   else if (isForaDoCarrinho(row)) semanasAnterioresForaDoCarrinho++;
   else if (isAgendada(row) && SCHEDULED_STATES.has(...)) semanasAnterioresAgendadas++;
   else semanasAnterioresOutros++;
   ```

f) Adicionar `semanasAnterioresOutros` à interface `R2CarrinhoKPIs`.

## 2. `src/hooks/useR2PendingLeads.ts`

Em `useR2PendingLeadsBreakdown(previousCutoff)`:
- Renomear o parâmetro para `safraStart` (ou aceitar ambos por compatibilidade) e usar a data de **início da safra** (`boundaries.contratos.start`), não o `previousCutoff`.

Em `useR2CarrinhoKPIs.ts`, atualizar a chamada:
```ts
const safraStartForPending = useMemo(
  () => getCarrinhoMetricBoundaries(weekStart, weekEnd, carrinhoConfig, previousConfig).contratos.start,
  [...]
);
const pendentesBreakdown = useR2PendingLeadsBreakdown(safraStartForPending);
```

(Bonus opcional: também filtrar parceiros em `useR2PendingLeads` cruzando com `partnerEmails`. Como Pendentes vem de outra fonte, isso fica para uma segunda iteração se aparecer divergência.)

## 3. `src/pages/crm/R2Carrinho.tsx`

- Atualizar a `description` (tooltip) do card "Semanas Anteriores" para mencionar que parceiros são excluídos e que o critério é "contrato pago em safra anterior à atual (antes da Qui 00:00)".
- Adicionar exibição opcional de `semanasAnterioresOutros` no tooltip do total: `+ X em outros estados (reagendado/sem status)` quando > 0. Isso garante que a soma dos sub-cards bata com o total mostrado.

## 4. Atualizar memória

Salvar nova memória: `mem://business-logic/r2-carrinho-semanas-anteriores-criteria` documentando:
- Cutoff de "semana anterior" = início da safra (Qui 00:00), NÃO `previousCutoff` (Sex 12:00)
- Parceiros (A001-A009, R001, INCORPORADOR, Renovação, Parceria) são excluídos de TODOS os KPIs do Carrinho R2, não apenas de `contratosPagos`

## Critério de aceitação

- Card "Semanas Anteriores" mostra **5** (não 11/12) na safra ativa
- Sub-cards somam exatamente o total: 2 + 1 + 1 + 0 + 1 (outros) = 5
- Emerson Aguiar não aparece em nenhum KPI (parceiro)
- Demais leads de Qui 30/04 (Cláudio, Maria, Victor, etc.) deixam de ser marcados como "semana anterior"
- KPIs operacionais (R2 Realizadas, Agendadas, No-Show) também excluem parceiros — `r2Realizadas` deve cair em pelo menos 1 (o Emerson)

## Riscos

- Excluir parceiros dos KPIs operacionais vai mudar números que hoje os usuários enxergam como "estabelecidos". Vale comunicar antes de mergear que essa correção alinha com a regra core já documentada.
- Mudar o cutoff afeta histórico — qualquer relatório/print antigo terá números diferentes. Aceitar se a regra de negócio é "Quinta = início da safra".
