
# Plano: Corrigir Discrepância de Valores e Salvamento Manual

## Problemas Identificados

### Problema 1: Discrepância de Valores (169 vs 167)
A edge function `recalculate-sdr-payout` usa a métrica errada:
- **Linha 346**: `reunioesAgendadas = metrics.r1_agendada || 0`
- Isso pega `r1_agendada` (reuniões marcadas PARA o período = 167)
- Deveria usar `agendamentos` (reuniões criadas NO período = 169)

### Problema 2: Salvamento Manual Não Funciona
Fluxo atual quando usuário salva:
1. `useRecalculateWithKpi` salva KPI com valor editado (ex: 170)
2. Edge function é chamada
3. Edge function busca dados da Agenda e **SOBRESCREVE** o KPI (linhas 527-529)
4. Valor do usuário é perdido

---

## Solução

### Arquivo a Modificar
`supabase/functions/recalculate-sdr-payout/index.ts`

### Mudança 1: Usar `agendamentos` em vez de `r1_agendada`
```typescript
// Linha 346: ANTES
reunioesAgendadas = metrics.r1_agendada || 0;

// DEPOIS
reunioesAgendadas = metrics.agendamentos || 0;
```

### Mudança 2: Respeitar Valores Manuais
A edge function já busca o KPI existente antes de atualizar (linha 501-506). O problema é que ela sempre sobrescreve se a Agenda retornou dados.

Solução: Comparar timestamps para detectar edição manual recente:

```typescript
// Linhas 525-548: ANTES (sempre sobrescreve com Agenda)
const updateFields: Record<string, unknown> = {
  reunioes_agendadas: reunioesAgendadas > 0 
    ? reunioesAgendadas 
    : existingKpi.reunioes_agendadas,
  ...
};

// DEPOIS (preserva edição manual recente)
// Se KPI foi atualizado nos últimos 10 segundos, preservar valores manuais
const kpiUpdatedAt = new Date(existingKpi.updated_at).getTime();
const now = Date.now();
const wasManuallyEdited = (now - kpiUpdatedAt) < 10000; // 10 segundos

const updateFields: Record<string, unknown> = {
  // Preservar valores se foi edição manual recente
  reunioes_agendadas: wasManuallyEdited 
    ? existingKpi.reunioes_agendadas
    : (reunioesAgendadas > 0 ? reunioesAgendadas : existingKpi.reunioes_agendadas),
  
  reunioes_realizadas: wasManuallyEdited
    ? existingKpi.reunioes_realizadas
    : (reunioesRealizadas > 0 ? reunioesRealizadas : existingKpi.reunioes_realizadas),
  
  no_shows: wasManuallyEdited
    ? existingKpi.no_shows
    : (reunioesAgendadas > 0 ? noShows : existingKpi.no_shows),
  
  taxa_no_show: wasManuallyEdited
    ? existingKpi.taxa_no_show
    : (reunioesAgendadas > 0 ? taxaNoShow : existingKpi.taxa_no_show),
  
  updated_at: new Date().toISOString(),
};
```

---

## Fluxo Corrigido

```text
ANTES (Problemático):
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Usuário edita│ --> │ Salva KPI    │ --> │ Edge Function│
│ valor: 170   │     │ (170)        │     │ sobrescreve  │
└──────────────┘     └──────────────┘     │ com 167      │
                                          └──────────────┘

DEPOIS (Corrigido):
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Usuário edita│ --> │ Salva KPI    │ --> │ Edge Function│
│ valor: 170   │     │ (170)        │     │ PRESERVA 170 │
└──────────────┘     └──────────────┘     │ (edit < 10s) │
                                          └──────────────┘
```

---

## Resumo das Mudanças

| Linha | Mudança |
|-------|---------|
| 346 | `r1_agendada` → `agendamentos` |
| 525-548 | Adicionar lógica para preservar edições manuais recentes |

## Resultado Esperado

1. O indicador "Agendamento" mostrará 169 (igual ao formulário)
2. Edições manuais serão preservadas após salvar
3. Recálculos automáticos (batch mensal) continuarão atualizando com dados da Agenda
