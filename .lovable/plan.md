

## Problemas Identificados

### 1. Erro React #300 ao mudar de Mês para Dia/Semana
A sessão do usuário confirma: ao clicar "Mês" na Agenda, o ErrorBoundary captura o erro. O erro #300 significa "Objects are not valid as a React child" - algum objeto não-string está sendo renderizado como child do React.

**Causa provável**: No `AgendaCalendar.tsx`, o mês view (linhas 705-868) faz early return antes do `DragDropContext`. Quando o React troca de week/day view (com DragDropContext) para month view (sem), ou vice-versa, a mudança radical na árvore de componentes pode causar um estado inconsistente. Pode ser que durante a transição, algum valor intermediário (ex: `closers` vazio, `viewDays` com dados do modo anterior) tente renderizar um objeto Date diretamente.

### 2. Layout "confuso" nas views de Dia/Semana  
- **Day view**: Células usam `h-[40px]` mas `SLOT_HEIGHT = 48px`. Os cards de reunião são calculados com `SLOT_HEIGHT * slotsNeeded - 4 = 44px`, que não cabe em uma célula de 40px → overflow visual
- **Time column**: Também usa `h-[40px]` no day view, inconsistente com o `h-[48px]` do week view
- A coluna de hora do day view e as células dos closers têm altura diferente das células do week view

### Correções Propostas

| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `AgendaCalendar.tsx` | Unificar altura das células: trocar `h-[40px]` por `h-[48px]` nas células do day view (linhas 1041, 1088) para coincidir com `SLOT_HEIGHT = 48` |
| 2 | `AgendaCalendar.tsx` | Envolver o rendering do month view em try-catch defensivo para evitar crash na troca de views |
| 3 | `AgendaCalendar.tsx` | Adicionar guards no month view para valores null/undefined que possam causar o erro #300 |
| 4 | `AgendaCalendar.tsx` | Corrigir `getSlotsNeeded` - dividir por 15 (tamanho real do slot no grid) em vez de 30, para que cards de reunião tenham a altura correta |

### Detalhes Técnicos

**Fix 1 - Altura consistente (linhas 1041, 1088):**
```typescript
// Antes:
'h-[40px] ...'  // tanto na time column quanto nas cells do day view

// Depois:  
'h-[48px] ...'  // match com SLOT_HEIGHT e week view
```

**Fix 2 - Guard no month view (linhas 704-705):**
```typescript
// Adicionar guards antes do return do month view
if (viewMode === 'month') {
  if (!selectedDate || !closers) {
    return <div className="p-4 text-center text-muted-foreground">Carregando...</div>;
  }
  // ... rendering existente com try-catch
}
```

**Fix 3 - Guards defensivos no month view rendering:**
```typescript
// No map de meetings do month view (linha 759)
{dayMeetings.slice(0, 3).map(meeting => {
  if (!meeting?.id) return null;  // guard
  const closerColor = getCloserColor(meeting.closer_id, meeting.closer?.name);
  const scheduledAt = meeting.scheduled_at;
  if (!scheduledAt) return null;  // guard
  // ...
})}
```

**Fix 4 - Corrigir getSlotsNeeded (linha 686-688):**
```typescript
// Antes: divide por 30 (incorreto - slots são de 15min)
const getSlotsNeeded = (durationMinutes: number) => {
  return Math.ceil(durationMinutes / 30);
};

// Depois: divide por 15 (tamanho real do slot no grid)
const getSlotsNeeded = (durationMinutes: number) => {
  return Math.max(1, Math.ceil(durationMinutes / 15));
};
```
Isso faz com que uma reunião de 30min ocupe 2 slots (96-4=92px de altura), cobrindo visualmente os 2 slots de 15min que ela realmente ocupa.

### Resultado Esperado
- Sem crash ao trocar entre views (Dia/Sem/Mês)
- Cards de reunião com altura proporcional à duração real
- Layout uniforme entre day view e week view (ambos com 48px por slot)

