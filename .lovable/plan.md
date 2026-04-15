

## Plano: Incluir leads com R2 Aprovado fora da safra + Encaixados no relatório lifecycle

### Problema
O relatório lifecycle só captura leads cujo `contract_paid_at` cai na safra (Qui-Qua). Faltam dois grupos:

1. **Contratos pagos antes da safra** — leads que pagaram em semanas anteriores mas tiveram R2 aprovado na janela do carrinho atual
2. **Encaixados** — leads do acumulado que foram forçados para a semana via `carrinho_week_start` (botão "Encaixar no Carrinho")

O Carrinho R2 já conta ambos os grupos (via `useR2CarrinhoKPIs`), mas o relatório lifecycle não.

### Solução

Modificar `src/hooks/useContractLifecycleReport.ts` para adicionar dois caminhos de busca após o Step 1b:

**Step 1c — Leads com R2 Aprovado na janela do carrinho:**
1. Buscar `r2_status_options` com nome "aprovado"
2. Buscar R2 attendees com `r2_status_id` = aprovado, `scheduled_at` na janela Sex-Sex (usa `getCarrinhoMetricBoundaries`)
3. Coletar `deal_id` e excluir os que já estão nos `filteredR1Attendees`
4. Para os faltantes, buscar R1 attendees correspondentes por `deal_id` (ou por `contact_id` cross-pipeline)
5. Se não tem R1, criar row com campos R1 nulos e `r1Status = 'outside'`

**Step 1d — Encaixados (carrinho_week_start):**
1. Buscar R2 attendees com `carrinho_week_start` = weekStart da safra (formato `yyyy-MM-dd`)
2. Coletar `deal_id` e excluir os já capturados nos passos anteriores
3. Mesma lógica: buscar R1 correspondente ou criar row com R1 nulo

**Deduplicação:** Unir os 3 conjuntos por `deal_id` antes de continuar o pipeline (Steps 2-5 existentes).

**Dependência:** `filters.weekStart` já é passado pelo painel — usado para calcular a janela do carrinho e o `carrinho_week_start` string.

### Resultado esperado
- Aprovados no relatório = ~24 (alinhado com Carrinho R2)
- Encaixados aparecem no relatório com seus dados R2 corretos
- Leads sem R1 aparecem com campos R1 vazios

### Seção técnica
- Arquivo único: `src/hooks/useContractLifecycleReport.ts`
- ~60 linhas adicionais entre Step 1b e Step 2
- Import de `getCarrinhoMetricBoundaries` e `format` de date-fns
- Reutiliza `getCartWeekStart` para calcular `carrinho_week_start` string a partir de `filters.weekStart`

