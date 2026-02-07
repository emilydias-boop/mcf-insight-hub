
# Corrigir Edge Function: Meta de R1 Realizadas = 70% dos Agendamentos Reais

## Problema Diagnosticado

A varredura revelou que **todos os SDRs ativos** têm inconsistência entre:
- **Banco de dados**: meta_realizadas_ajustada calculada como 70% da META teórica
- **Frontend**: card exibe 70% dos AGENDAMENTOS REAIS (correto)

Isso causa divergência nos percentuais salvos e exibidos.

## Dados Afetados (Janeiro 2026)

| SDR | Agendamentos | Meta Banco | Meta Correta | Diferença |
|-----|--------------|------------|--------------|-----------|
| Carol Correa | 181 | 126 | 127 | +1 |
| Carol Souza | 148 | 98 | 104 | +6 |
| Antony Elias | 132 | 98 | 92 | -6 |
| Jessica Martins | 169 | 140 | 118 | -22 |
| Julia Caroline | 112 | 126 | 78 | -48 |
| Leticia Nunes | 153 | 98 | 107 | +9 |
| Cleiton Lima | 217 | 98 | 152 | +54 |
| Vinicius Rangel | 58 | 98 | 41 | -57 |

## Solucao

### 1. Atualizar Edge Function (recalculate-sdr-payout)

**Arquivo:** `supabase/functions/recalculate-sdr-payout/index.ts`

**Linha 302 - ANTES:**
```typescript
// Meta de Realizadas = 70% da META de agendadas do mês (não do valor real)
const metaRealizadasAjustada = Math.round(metaAgendadasAjustada * 0.7);
```

**DEPOIS:**
```typescript
// Meta de Realizadas = 70% dos AGENDAMENTOS REALIZADOS (consistente com frontend)
const metaRealizadasAjustada = Math.round((kpi.reunioes_agendadas || 0) * 0.7);
```

### 2. Recalcular Payouts do Mes

Apos a correcao, executar o recalculo para todos os SDRs de Janeiro 2026 para atualizar os percentuais.

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/recalculate-sdr-payout/index.ts` | Usar kpi.reunioes_agendadas na linha 302 |

## Resultado Esperado

Apos a correcao e recalculo:

1. **meta_realizadas_ajustada** no banco sera igual ao exibido no card
2. **pct_reunioes_realizadas** sera recalculado corretamente
3. Consistencia total entre frontend, banco e formulario de KPIs

## Exemplo de Verificacao (Carol Correa)

| Campo | Antes | Depois |
|-------|-------|--------|
| meta_realizadas_ajustada | 126 | 127 |
| pct_reunioes_realizadas | 98.41% | 97.64% |
| Exibicao no Card | 127 | 127 |
