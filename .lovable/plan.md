
# Corrigir Faturamento por Mês no TeamGoalsSummary

## Problema Identificado

O componente `TeamGoalsSummary` mostra o faturamento de **fevereiro** quando o usuário seleciona **janeiro** no fechamento. Isso acontece porque:

1. O hook `useUltrametaByBU()` sempre usa `new Date()` para calcular o período
2. Não recebe o parâmetro `anoMes` do mês selecionado
3. Resultado: mostra R$ 329.568 (fevereiro) em vez de R$ 2.035.898 (janeiro)

## Arquitetura da Solução

### Opção Escolhida: Criar Hook Específico para Faturamento por Mês

Em vez de modificar o `useUltrametaByBU` (que é usado em outros lugares para o mês atual), vou criar lógica específica no `TeamGoalsSummary` que calcula o faturamento baseado no `anoMes` recebido como prop.

## Mudanças Necessárias

### 1. Modificar `TeamGoalsSummary.tsx`

**Adicionar cálculo de faturamento específico para o mês selecionado:**

- Usar o `anoMes` recebido como prop para definir o período
- Buscar transações diretamente via RPC `get_all_hubla_transactions` com as datas corretas
- Aplicar a mesma lógica de deduplicação (`getDeduplicatedGross`)
- Remover dependência do `useUltrametaByBU()` que sempre usa o mês atual

**Lógica de cálculo por BU:**
- **Incorporador**: Usar RPC `get_all_hubla_transactions` + deduplicação
- **Consórcio**: Somar `valor_credito` da tabela `consortium_cards`
- **Leilão**: Somar transações com `product_category = 'clube_arremate'`

### 2. Criar Hook Auxiliar (Opcional)

Se necessário reutilizar essa lógica, podemos criar um hook `useTeamRevenueByMonth(anoMes, bu)` que:
- Recebe `anoMes` (ex: "2026-01") e `bu` (ex: "incorporador")
- Calcula o faturamento específico do mês
- Retorna o valor correto

## Fluxo Corrigido

```text
ANTES (errado):
TeamGoalsSummary(anoMes="2026-01")
  └── useUltrametaByBU() 
       └── new Date() → fevereiro 2026
            └── Faturamento: R$ 329.568 ❌

DEPOIS (correto):
TeamGoalsSummary(anoMes="2026-01")
  └── Calcular início/fim de janeiro 2026
       └── RPC get_all_hubla_transactions(jan 1-31)
            └── Faturamento: R$ 2.035.898 ✅
```

## Código da Correção

O `TeamGoalsSummary` passará a:

1. Parsear o `anoMes` para extrair ano e mês
2. Calcular `startOfMonth` e `endOfMonth` do mês selecionado
3. Buscar transações do período correto
4. Aplicar deduplicação
5. Exibir o faturamento correto

## Resultado Esperado

- Janeiro 2026 → Faturamento R$ 2.035.898,00 (mesmo valor da página de transações)
- Metas comparadas corretamente com o faturamento do mês
- Meta, Supermeta, Ultrameta e Meta Divina calculadas sobre o valor correto
