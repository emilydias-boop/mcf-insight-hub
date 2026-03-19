

## Plano: Correções e Melhorias nas Funções de Cobrança

### Problemas Identificados

**1. KPI "Clientes em Risco" mostra 0 (deveria ser 39)**
- A query em `useBillingKPIs` filtra parcelas atrasadas por `data_vencimento` do mês selecionado (linhas 203-204)
- Isso conta apenas parcelas vencidas **naquele mês**, não o total acumulado de atraso do cliente
- Para risco de cancelamento, o correto é contar TODAS as parcelas atrasadas do cliente, não apenas as do mês

**2. KPI "Nunca Contatados" mostra 179 (deveria ser ~1261)**
- A query usa `atrasadaIds.slice(0, 200)` (linha 223) — trunca em 200 IDs
- Com 1261 subs atrasadas, só verifica os primeiros 200
- Precisa iterar em chunks como já é feito em outros lugares

**3. Warning de "unique key" no CobrancaInstallments**
- Console mostra warning de key prop duplicada no componente de parcelas

**4. Fila de Cobrança sem paginação/limite**
- Carrega todos os 1261 itens de uma vez — pode ser lento
- Deveria ter paginação ou limite (ex: top 50 por risco)

### Correções

**Arquivo: `src/hooks/useBillingSubscriptions.ts`**

1. **Clientes em Risco** — remover o filtro de mês da query de risco. Buscar TODAS as parcelas atrasadas globalmente para calcular o risco real:
   - Remover `if (monthStart && monthEnd)` das linhas 203-204 da `riskInstQuery`
   - Assim conta o total acumulado de parcelas atrasadas por sub, independente do mês

2. **Nunca Contatados** — iterar em chunks de 200 ao invés de `slice(0, 200)`:
   - Loop: `for (let i = 0; i < atrasadaIds.length; i += 200)` com chunk query
   - Acumular os `subscription_id` contatados num Set global

3. **Remover código morto** — o `overdueCountMap` (linhas 189-197) não é usado para nada, pode ser removido

**Arquivo: `src/hooks/useBillingQueue.ts`**

4. **Limitar fila a top 100** — adicionar `.slice(0, 100)` no resultado final para não renderizar 1261 linhas

**Arquivo: `src/components/financeiro/cobranca/CobrancaInstallments.tsx`**

5. **Fix unique key warning** — verificar e corrigir a key prop duplicada

### Resultado Esperado
- "Clientes em Risco" mostrará ~39 (correto)
- "Nunca Contatados" mostrará ~1261 (correto — todos atrasados sem contato manual)
- Performance melhorada com limite na fila
- Console limpo sem warnings

