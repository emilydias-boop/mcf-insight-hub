

## Resultado da Análise: Fluxo de Fechamento Individual (Fev e Mar 2026)

### Fevereiro 2026 - Cálculos CORRETOS

Validei manualmente os números de 5 SDRs promovidos + Juliana Rodrigues. **Todos os cálculos batem:**

| SDR | Agend. | Meta | %Agend | Mult | Real. | MetaR | %Real | Mult | Variável | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| Antony (N1) | 89 | 119 | 58.2% | 0 | 64 | 62 | 103.2% | 1 | R$743 | R$3.543 |
| Carol C (N2) | 121 | 153 | 71.2% | 0.5 | 94 | 85 | 110.6% | 1 | R$1.088 | R$4.238 |
| Carol S (N1) | 106 | 119 | 69.3% | 0 | 83 | 74 | 112.2% | 1 | R$743 | R$3.543 |
| Julia (N1) | 101 | 153 | 66.0% | 0 | 71 | 71 | 100% | 1 | R$743 | R$3.543 |
| Leticia (N1) | 105 | 119 | 68.6% | 0 | 93 | 74 | 125.7% | 1.5 | R$1.415 | R$4.215 |
| Juliana R (N1) | 70 | 119 | 58.8% | 0 | 52 | 49 | 106.1% | 1 | R$743 | R$3.543 |

Fórmulas conferidas: meta_realiz = 70% × agendadas_reais; multiplicadores conforme faixas (0-70%=0, 71-85%=0.5, etc). Tudo OK.

### Março 2026 - 3 Problemas Detectados

**Problema 1: Payouts com valor_fixo desatualizado (CRÍTICO)**

Os payouts de março foram gerados ANTES das promoções de nível. O `valor_fixo` está errado:

| SDR | Cargo Março | fixo correto | fixo no payout | Diferença |
|---|---|---|---|---|
| Antony Elias | N2 | R$3.150 | R$2.800 | -R$350 |
| Carol Souza | N2 | R$3.150 | R$2.800 | -R$350 |
| Julia Caroline | N2 | R$3.150 | R$2.800 | -R$350 |
| Leticia Nunes | N2 | R$3.150 | R$2.800 | -R$350 |
| Carol Correa | N3 | R$3.500 | R$3.150 | -R$350 |

**Correção**: Recalcular os payouts de março (via botão "Recalcular" ou via Edge Function) atualizará automaticamente o `valor_fixo` a partir do comp_plan vigente.

**Problema 2: Março sem métricas configuradas**

A tabela `fechamento_metricas_mes` para `2026-03` está **vazia**. O sistema usará métricas fallback (padrão hardcoded), que podem não corresponder aos pesos que vocês definiram para fevereiro. Solução: copiar as métricas de fev para março na aba Configurações > Métricas Ativas.

**Problema 3: Métricas duplicadas em Fevereiro (menor impacto)**

SDR Inside N1 e N2 em fevereiro têm métricas duplicadas porque existem registros com `squad='incorporador'` E `squad=NULL` para o mesmo cargo. O hook `useActiveMetricsForCargo` prioriza squad-specific, então o frontend exibe corretamente. A Edge Function faz o mesmo. Não é bug funcional, mas poluição de dados.

### Plano de Correção

1. **Copiar métricas para março**: Na tela Configurações > Métricas Ativas, copiar configuração de fevereiro para março (ou configurar manualmente)
2. **Recalcular payouts de março**: Após copiar métricas, executar recálculo para os 5 SDRs promovidos para atualizar o `valor_fixo` e demais campos
3. **Limpar duplicatas de fevereiro** (opcional): Remover registros com `squad=NULL` que conflitam com os de `squad='incorporador'`

Posso executar os itens 1, 2 e 3 automaticamente via SQL + invocação da Edge Function.

