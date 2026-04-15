

## Plano: Alinhar R2 usada no relatório lifecycle com a janela do Carrinho

### Problema
O relatório lifecycle seleciona a R2 mais recente por `deal_id` (qualquer data), enquanto o Carrinho filtra R2s pela janela Sex-Sex. Isso gera:
- Carlos Magno: relatório mostra R2 do dia 16/04 (agendado), Carrinho mostra R2 do dia 10/04 (no-show)
- KPIs de "Agendados" não batem entre as duas views

### Causa raiz
No Step 4 do `useContractLifecycleReport.ts` (linha 453), ao buscar R2 attendees por `deal_id`, o código pega sempre a com `scheduled_at` mais recente:
```ts
if (!existing || (newDate && (!existing.r2Date || newDate > existing.r2Date))) {
```
Isso ignora a janela do carrinho — uma R2 futura (16/04) sobrepõe a da semana (10/04).

### Correção em `src/hooks/useContractLifecycleReport.ts`

**Opção: Priorizar a R2 dentro da janela do carrinho**

No Step 4, ao resolver qual R2 usar para cada deal_id, preferir a R2 que cai dentro da janela do carrinho (Sex anterior → Sex atual). Se houver uma dentro e uma fora, usar a de dentro. Se ambas estão dentro, usar a mais recente.

Lógica:
1. Calcular a janela R2 usando `getCarrinhoMetricBoundaries` (já importado)
2. No loop que popula `r2Map`, para cada R2:
   - Se a nova R2 está **dentro** da janela e a existente está **fora** → substituir
   - Se ambas estão dentro (ou ambas fora) → manter a mais recente (comportamento atual)
   - Se a nova está fora e a existente dentro → manter a existente

```text
Prioridade:
  1. Dentro da janela carrinho, mais recente
  2. Fora da janela, mais recente (fallback)
```

Isso garante que:
- Carlos Magno use a R2 de 10/04 (no-show, dentro da janela) em vez da de 16/04 (fora)
- Os KPIs de "Agendados" e "No-show" fiquem alinhados com o Carrinho

### Seção técnica
- Arquivo: `src/hooks/useContractLifecycleReport.ts`, Step 4 (~linhas 446-468)
- ~10 linhas alteradas no critério de seleção de R2 por deal_id
- Usa `boundaries.r2Meetings` para determinar se a R2 cai dentro da janela

