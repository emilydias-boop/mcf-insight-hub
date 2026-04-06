

# Alinhar fechamento Consórcio com métricas reais da planilha

## Problemas identificados

Comparando o sistema atual com a planilha do João Pedro:

**1. Multiplicadores errados**
O código usa as faixas do SDR, mas consórcio tem faixas diferentes:

```text
Sistema atual          |  Planilha real
-----------------------|------------------
< 50%  → 0            |  0-70%   → 0
50-70% → 0.5          |  71-85%  → 0.5
70-100% → 0.7         |  86-99%  → 0.7
100-150% → 1          |  100-119% → 1
150%+ → 1.5           |  120%+   → 1.5
```

**2. Pesos hardcoded e errados**
O código tem `PESOS_CLOSER_CONSORCIO = { comissao_consorcio: 0.72, comissao_holding: 0.18, organizacao: 0.10 }`, mas a planilha mostra **90% / 0% / 10%** para abril. Os pesos deveriam vir da configuração de **Métricas Ativas** (`fechamento_metricas_mes`), não serem fixos.

**3. Métricas não configuradas**
O screenshot mostra que as métricas para "Closer Consórcio" em abril estão todas desativadas — precisam ser ativadas com os pesos corretos.

## Solução

### Arquivo 1: `src/types/consorcio-fechamento.ts`

- Criar `getMultiplierConsorcio(pct)` com as faixas corretas (0-70→0, 71-85→0.5, 86-99→0.7, 100-119→1, 120+→1.5)
- Remover `PESOS_CLOSER_CONSORCIO` hardcoded
- Refatorar `calcularPayoutConsorcio` para receber os pesos como parâmetro em vez de usar constantes fixas

### Arquivo 2: `src/hooks/useConsorcioFechamento.ts`

No `useRecalculateConsorcioPayouts`:
- Buscar métricas ativas do mês em `fechamento_metricas_mes` para o cargo "Closer Consórcio" (ou squad "consorcio")
- Extrair `peso_percentual` de cada métrica configurada (ex: comissao_consorcio=90%, organizacao=10%)
- Passar os pesos dinâmicos para `calcularPayoutConsorcio`
- Se não houver métricas configuradas, usar fallback com pesos padrão (90/0/10)
- Usar `getMultiplierConsorcio` em vez de `getMultiplier`

No `useUpdateConsorcioPayoutKpi`:
- Mesma lógica: buscar pesos das métricas ativas antes de recalcular

### Arquivo 3: Componentes de exibição (indicator cards, detail page)

- Atualizar referências a `PESOS_CLOSER_CONSORCIO` para usar os pesos salvos no payout ou buscados dinamicamente

## Resultado esperado
- João Pedro com 136.26% de atingimento em comissão consórcio → mult 1.5 (≥120%) → R$ 2,835 (90% × R$2,100 × 1.5)
- Holding 0% de peso → R$ 0
- Organização 100% → mult 1 → R$ 210 (10% × R$2,100 × 1)
- Total variável: R$ 3,045
- Total conta: R$ 4,900 + R$ 3,045 + R$ 660 (iFood) = R$ 8,605

