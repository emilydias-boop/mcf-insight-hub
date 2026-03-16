

## Diagnóstico: Contratos do Carrinho não consideram o horário de corte nas fronteiras da semana

### Situação atual

O sistema usa as fronteiras de semana customizada (Sábado 00:00 a Sexta 23:59) para buscar tanto transações quanto reuniões R2. Para a semana 07/03-13/03:

- **Transações**: `sale_date >= '2026-03-07 00:00'` e `sale_date <= '2026-03-13 23:59'`
- **Reuniões R2**: mesmo intervalo de datas

### Problema

O carrinho tem `horario_corte: 12:00`. A última reunião do carrinho da semana anterior (01/03-06/03) acontece na **sexta 06/03 às 12:00**. Contratos vendidos **entre 06/03 12:00 e 07/03 00:00** não são capturados em nenhum carrinho:

- Semana anterior (01-06/03): busca até 06/03 23:59, mas esses contratos são POSTERIORES ao último carrinho da semana
- Semana atual (07-13/03): busca a partir de 07/03 00:00, não captura vendas da sexta à tarde

O correto é: **contratos vendidos após o horário de corte da sexta (12:00 do dia 06/03) devem pertencer ao carrinho da semana seguinte (07-13/03)**.

### Solução

Ajustar a fronteira de início das queries de transações para usar o `horario_corte` do último dia da semana anterior, em vez de meia-noite do primeiro dia.

**Arquivos afetados:**

1. **`src/hooks/useR2CarrinhoVendas.ts`** (linhas 146-147)
   - Calcular `effectiveStart` como: sexta-feira anterior (weekStart - 1 dia) ao meio-dia (horario_corte da config)
   - Calcular `effectiveEnd` como: sexta-feira atual (weekEnd) ao meio-dia
   - Usar esses valores nas queries de `sale_date`

2. **`src/hooks/useR2CarrinhoKPIs.ts`** (linhas 22-28 e 40-55)
   - Aplicar a mesma lógica de fronteiras ajustadas para `contratosPagos` e reuniões R2

3. **`src/hooks/useR2CarrinhoData.ts`** (linhas ~70-80)
   - Ajustar as queries de `meeting_slots.scheduled_at` para usar fronteiras baseadas no horário de corte

4. **Criar um helper compartilhado** (ex: `getCarrinhoWeekBoundaries(weekStart, weekEnd, config)`)
   - Recebe a config do carrinho para extrair o `horario_corte`
   - Retorna `{ effectiveStart: Date, effectiveEnd: Date }` 
   - `effectiveStart` = dia anterior ao weekStart + horario_corte (ex: 06/03 12:00)
   - `effectiveEnd` = weekEnd + horario_corte (ex: 13/03 12:00)
   - Todos os hooks usam esse helper para consistência

### Exemplo concreto (semana 07-13/03, corte 12:00)

| Antes | Depois |
|-------|--------|
| `sale_date >= 07/03 00:00` | `sale_date >= 06/03 12:00` |
| `sale_date <= 13/03 23:59` | `sale_date < 14/03 12:00` |

### Observação

Os hooks `useR2CarrinhoVendas`, `useR2CarrinhoKPIs` e `useR2CarrinhoData` precisarão receber a `config` do carrinho como parâmetro (ou buscá-la internamente) para calcular as fronteiras corretas. A página `R2Carrinho.tsx` já possui a config carregada via `useCarrinhoConfig`.

