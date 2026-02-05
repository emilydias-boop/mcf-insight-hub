
# Plano: Unificar Cálculo de No-Show em Todo o Sistema

## Mudança de Lógica

| Lógica Atual | Nova Lógica |
|--------------|-------------|
| `no_shows` = COUNT de status 'no_show' | `no_shows` = Agendamentos - R1 Realizada |
| Depende de marcação manual na agenda | Cálculo automático e consistente |

### Resultado Esperado (Carol Correa - Jan/26):
- Agendamentos: **181**
- R1 Realizada: **124**  
- No-Show (novo): **57** (181 - 124)
- A conta sempre fechará: **Agendamentos = Realizada + No-Show**

---

## Arquivos a Alterar

### 1. RPC `get_sdr_metrics_from_agenda` (Migration SQL)

**O que**: Alterar a função para calcular `no_shows` como diferença ao invés de contar por status.

**Antes** (linhas 39-42):
```sql
COUNT(CASE WHEN (ms.scheduled_at...)::date >= start_date::DATE 
            AND (ms.scheduled_at...)::date <= end_date::DATE 
            AND msa.status = 'no_show' THEN 1 END) as no_shows,
```

**Depois**:
```sql
-- no_shows será calculado no SELECT final como diferença
-- Remover a contagem por status e calcular: agendamentos - r1_realizada
GREATEST(0, agendamentos - r1_realizada) as no_shows,
```

---

### 2. Edge Function `recalculate-sdr-payout/index.ts`

**Arquivo**: `supabase/functions/recalculate-sdr-payout/index.ts`  
**Linhas**: 685-688

**Antes**:
```typescript
reunioesAgendadas = metrics.agendamentos || 0;
noShows = metrics.no_shows || 0;
reunioesRealizadas = metrics.r1_realizada || 0;
taxaNoShow = reunioesAgendadas > 0 ? (noShows / reunioesAgendadas) * 100 : 0;
```

**Depois**:
```typescript
reunioesAgendadas = metrics.agendamentos || 0;
reunioesRealizadas = metrics.r1_realizada || 0;
// NOVA LÓGICA: No-Show = Agendamentos - Realizadas
noShows = Math.max(0, reunioesAgendadas - reunioesRealizadas);
taxaNoShow = reunioesAgendadas > 0 ? (noShows / reunioesAgendadas) * 100 : 0;
```

---

### 3. Hook `useTeamMeetingsData.ts` (Painel de Equipe)

**Arquivo**: `src/hooks/useTeamMeetingsData.ts`  
**Linhas**: 71-75 e 86

**Antes** (linha 74):
```typescript
noShows: m.no_shows,
```

**Depois**:
```typescript
// Calcular no frontend para garantir consistência
noShows: Math.max(0, m.agendamentos - m.r1_realizada),
```

---

### 4. Hook `useMinhasReunioesFromAgenda.ts` (Minhas Reuniões)

**Arquivo**: `src/hooks/useMinhasReunioesFromAgenda.ts`  
**Linhas**: 34-47

**Antes**:
```typescript
const agendamentos = myMetrics?.agendamentos || 0;
const r1Realizada = myMetrics?.r1_realizada || 0;
const noShows = myMetrics?.no_shows || 0;
```

**Depois**:
```typescript
const agendamentos = myMetrics?.agendamentos || 0;
const r1Realizada = myMetrics?.r1_realizada || 0;
// NOVA LÓGICA: No-Show = Agendamentos - Realizadas
const noShows = Math.max(0, agendamentos - r1Realizada);
```

---

### 5. Componente `SdrSummaryTable.tsx` (Tabela de SDRs)

**Arquivo**: `src/components/sdr/SdrSummaryTable.tsx`  
**Linhas**: 168-182

**Contexto**: O componente já recebe `row.noShows` do hook. Com a alteração no hook (#3), funcionará automaticamente.

**Taxa de No-Show** (linha 171-175) - VERIFICAR:
```typescript
// Atualmente usa r1Agendada como denominador
(row.noShows / row.r1Agendada) * 100
```

**Decisão**: Manter ou mudar para `row.agendamentos`? 
- Se mudar para `row.agendamentos`, a taxa será: `noShows / agendamentos × 100`
- Como `noShows = agendamentos - r1Realizada`, a taxa seria: `(agendamentos - r1Realizada) / agendamentos × 100`

---

### 6. Componente `MeetingSummaryCards.tsx` (Cards de Resumo)

**Arquivo**: `src/components/sdr/MeetingSummaryCards.tsx`  
**Linhas**: 47-53

**Antes**:
```typescript
noShows: summary.noShows,
taxaNoShow: summary.reunioesAgendadas > 0 
  ? (summary.noShows / summary.reunioesAgendadas) * 100 
  : 0
```

**Depois**: Ajustar para usar a nova lógica no cálculo da taxa.

---

### 7. Componente `NoShowIndicator.tsx` (Indicador Visual)

**Arquivo**: `src/components/sdr-fechamento/NoShowIndicator.tsx`  
**Linhas**: 21

**Contexto**: Recebe `agendadas` e `noShows` como props. Não precisa alterar o componente em si, apenas garantir que os valores passados sigam a nova lógica.

---

### 8. Componente `KpiEditForm.tsx` (Edição Manual)

**Arquivo**: `src/components/sdr-fechamento/KpiEditForm.tsx`  
**Linhas**: 158-160, 173-174

**Antes**:
```typescript
const taxa_no_show = formData.reunioes_agendadas > 0
  ? (formData.no_shows / formData.reunioes_agendadas) * 100
  : 0;
```

**Contexto**: Este é um formulário de edição manual. Manter a possibilidade de ajuste manual, mas atualizar o cálculo da taxa se o campo `no_shows` for alterado automaticamente.

---

### 9. Hook `useOwnFechamento.ts` (Closers)

**Arquivo**: `src/hooks/useOwnFechamento.ts`  
**Linhas**: 229-231

**Antes**:
```typescript
const taxaNoShow = r1Agendada > 0 
  ? (noShows / r1Agendada) * 100 
  : 0;
```

**Depois**: Este hook é para **Closers**, não SDRs. Verificar se a mesma lógica deve ser aplicada ou se Closers usam dados diferentes.

---

### 10. Componente `CloserDetailKPICards.tsx` (KPIs de Closer)

**Arquivo**: `src/components/closer/CloserDetailKPICards.tsx`  
**Linhas**: 105-107

**Contexto**: Similar ao item #9, este é para Closers. A fonte de dados é diferente (`m.noshow` vem de outra query).

---

## Sequência de Implementação

| Ordem | Arquivo | Tipo | Impacto |
|-------|---------|------|---------|
| 1 | Migration SQL | RPC | Fonte primária - altera cálculo no banco |
| 2 | `recalculate-sdr-payout` | Edge Function | Fechamento SDR |
| 3 | `useTeamMeetingsData.ts` | Hook | Painel de Equipe (CRM) |
| 4 | `useMinhasReunioesFromAgenda.ts` | Hook | Minhas Reuniões |
| 5 | `MeetingSummaryCards.tsx` | Componente | Cards de resumo |
| 6 | Validar funcionamento | Testes | Garantir consistência |

---

## Considerações Importantes

### O que NÃO será alterado:
- **Closers**: Os hooks `useOwnFechamento` e `CloserDetailKPICards` usam dados diferentes (métricas de Closer, não SDR). Manter lógica separada.
- **Formulário de Edição Manual**: Permitir ajustes manuais quando necessário.
- **Status 'no_show' na Agenda**: O status continuará existindo para rastreamento, mas não será a fonte do cálculo.

### Resultado Final:
Após a implementação, em TODOS os painéis de SDR:
- **Agendamentos** = R1 Realizada + No-Show
- A conta sempre fechará matematicamente
- Painel de Equipe e Fechamento mostrarão os mesmos números
