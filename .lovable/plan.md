

## Corrigir "Situação Cota" mostrando "Quitada" incorretamente

### Problema

A função `calcSituacaoCota` verifica se **todas as parcelas visíveis** estão pagas. Como a query filtra por `selectedMonth`, ela só vê as parcelas daquele mês. Se a parcela de abril está paga, o sistema conclui que a cota inteira está quitada -- mesmo tendo 239 parcelas futuras pendentes.

### Solução

Para calcular a situação real da cota, precisamos consultar o total de parcelas e parcelas pagas de cada card_id **sem filtro de mês**. Duas abordagens possíveis:

**Abordagem escolhida**: Fazer uma query separada e leve para obter, por `card_id` presente nos dados filtrados, o total de parcelas e quantas estão pagas. Isso evita carregar todas as 240 parcelas de cada carta.

### Mudanças

**`src/hooks/useConsorcioPagamentos.ts`**:

1. Adicionar uma segunda query (dentro do mesmo `useQuery` ou como query auxiliar) que, para os `card_id`s presentes nos resultados do mês, busca:
   ```sql
   SELECT card_id, 
          COUNT(*) as total_parcelas, 
          COUNT(*) FILTER (WHERE status = 'pago' OR data_pagamento IS NOT NULL) as parcelas_pagas,
          bool_or(status != 'pago' AND data_pagamento IS NULL AND data_vencimento < CURRENT_DATE) as tem_atraso
   FROM consortium_installments 
   WHERE card_id IN (...)
   GROUP BY card_id
   ```

2. Alterar `calcSituacaoCota` para usar esses dados globais:
   - **Quitada**: `parcelas_pagas == total_parcelas` (todas as 240 pagas)
   - **Em atraso**: `tem_atraso == true`
   - **Pendente**: caso contrário

3. Como não temos RPC, faremos via Supabase client: após obter os `card_id`s únicos do mês, buscar **todas** as parcelas desses cards (apenas `id, card_id, status, data_pagamento, data_vencimento`) e calcular no frontend. Otimização: buscar só os campos mínimos.

### Resultado esperado

- Cotas com 240 meses e apenas 1-3 parcelas pagas mostrarão "Pendente"
- Cotas com parcelas vencidas e não pagas mostrarão "Em Atraso"
- Somente cotas com TODAS as parcelas pagas mostrarão "Quitada"
- KPI "Cotas Quitadas" refletirá o número real

