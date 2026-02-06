
# Corrigir Bônus de iFood Ultrameta para BU Incorporador

## Problema Identificado

Quando a Ultrameta do time é batida (faturamento >= R$ 1.600.000), o sistema deveria adicionar R$ 1.000 ao iFood de todos os colaboradores da BU Incorporador. Atualmente isso não está acontecendo devido a:

1. **Discrepância no cálculo de faturamento**: A Edge Function usa uma lógica de deduplicação diferente do frontend
2. **Bug na função de deduplicação**: A Edge Function retorna `product_price` para parcelas > 1 ao invés de 0
3. **Ausência de preços fixos**: A Edge Function não utiliza os preços fixos configurados para produtos

## Análise dos Valores

| Componente | Valor Calculado | Lógica |
|------------|-----------------|--------|
| Edge Function | ~R$ 201.287 | Deduplicação com bugs |
| Frontend (estimativa) | ~R$ 1.315.332 | `getDeduplicatedGross` correto |
| Meta Ultrameta | R$ 1.600.000 | Configurado em `team_monthly_goals` |
| Prêmio iFood | R$ 1.000 | Configurado em `ultrameta_premio_ifood` |

## Solução

### 1. Corrigir Edge Function (`supabase/functions/recalculate-sdr-payout/index.ts`)

**Problema atual (linhas 499-507):**
```javascript
const getDeduplicatedGross = (tx: any, isFirst: boolean): number => {
  if (tx.gross_override !== null && tx.gross_override !== undefined) {
    return tx.gross_override;
  }
  const isInstallment = tx.installment_number && tx.installment_number > 1;
  if (isInstallment) return tx.product_price || 0;  // BUG: deveria ser 0
  if (isFirst) return tx.product_price || 0;
  return 0;
};
```

**Correção:**
```javascript
const getDeduplicatedGross = (tx: any, isFirst: boolean): number => {
  // Regra 1: Parcela > 1 sempre tem bruto zerado
  const installment = tx.installment_number || 1;
  if (installment > 1) {
    return 0;
  }
  
  // Regra 2: Override manual tem prioridade absoluta
  if (tx.gross_override !== null && tx.gross_override !== undefined) {
    return tx.gross_override;
  }
  
  // Regra 3: NÃO é primeira transação do grupo cliente+produto = 0
  if (!isFirst) {
    return 0;
  }
  
  // Regra 4: É primeira - usar product_price
  return tx.product_price || 0;
};
```

### 2. Verificar Meta do Time Corretamente

A Edge Function precisa usar a mesma lógica do frontend para calcular o faturamento da BU. Atualmente ela pode estar calculando um valor muito baixo, fazendo com que `buUltrametaHit['incorporador']` seja `false` quando deveria ser `true`.

### 3. Fluxo Esperado Após Correção

```text
1. Edge Function calcula faturamento Incorporador = R$ 1.600.000+
2. buUltrametaHit['incorporador'] = true
3. Para cada SDR/Closer da BU Incorporador elegível:
   - ifood_ultrameta = teamGoal.ultrameta_premio_ifood (R$ 1.000)
   - total_ifood = ifood_mensal + R$ 1.000
4. Payout salvo com novo valor
```

## Arquivos a Modificar

1. **`supabase/functions/recalculate-sdr-payout/index.ts`**:
   - Corrigir função `getDeduplicatedGross` (linhas 499-507)
   - Garantir que a lógica de cálculo de `buRevenue['incorporador']` seja consistente com o frontend

## Resultado Esperado

Após a correção e recálculo:
- Todos os SDRs e Closers da BU Incorporador elegíveis terão:
  - `ifood_ultrameta`: R$ 1.000
  - `total_ifood`: ifood_mensal + R$ 1.000
- O campo ficará visível na página de detalhe do fechamento
- O valor será somado ao Total iFood

## Observação

A lógica de elegibilidade (`elegivelUltrameta`) já está implementada:
- Colaboradores que entraram durante o mês (data_admissao >= início do mês) **não** recebem o bônus
- Apenas colaboradores que estavam no time desde o início do mês são elegíveis
