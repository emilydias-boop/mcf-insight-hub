

## Plano: Indicador visual de slot lotado nas Agendas R1

### Objetivo
Quando um horário atinge a capacidade máxima de leads (ex: 3/3), exibir um indicador visual claro de "LOTADO" nas duas views: **Calendário** (AgendaCalendar) e **Por Closer** (CloserColumnCalendar).

### Alterações

| Arquivo | O que muda |
|---------|------------|
| `src/components/crm/CloserColumnCalendar.tsx` | Quando `!available && !isBlocked && isSlotConfigured`: exibir célula vermelha com ícone de cadeado e texto "Lotado" + contador (ex: "3/3"). Atualmente mostra `<div>` vazio. |
| `src/components/crm/AgendaCalendar.tsx` | Adicionar lógica similar: função `isSlotFull(day, hour, minute, closerId)` que verifica se `totalAttendees >= maxLeads`. Exibir badge "Lotado" no slot com fundo vermelho/amarelo quando cheio. |

### Detalhes — CloserColumnCalendar (Por Closer)

A lógica de capacidade já existe (linhas 184-207): `isSlotAvailable` retorna `false` quando `totalAttendees >= maxLeads`. O trecho que renderiza o slot vazio (linha 525-526) será substituído:

```
// Onde hoje mostra div vazio quando configured mas lotado:
) : isConfigured && !available ? (
  <div className="w-full h-full min-h-[36px] flex items-center justify-center rounded 
    bg-red-500/10 border border-red-500/30">
    <Lock className="h-3 w-3 text-red-400 mr-1" />
    <span className="text-[10px] font-medium text-red-400">
      Lotado ({totalAttendees}/{maxLeads})
    </span>
  </div>
```

Precisa adicionar helper `isSlotConfigured(closerId, slot)` separado de `isSlotAvailable`, e calcular `totalAttendees`/`maxLeads` para o slot.

### Detalhes — AgendaCalendar (Calendário)

O `AgendaCalendar` não tem lógica de capacidade por closer/slot hoje. Adicionar:

1. Nova função `getSlotCapacityInfo(day, hour, minute)` que para cada closer configurado no slot, verifica se `attendees >= max_leads` (via `closer_meeting_links.max_leads` ou `closers.max_leads_per_slot`).
2. Precisa acessar dados de `closer_meeting_links` (já disponível via `meetingLinkSlots`) e `closers` (já prop).
3. Quando TODOS os closers de um slot estão lotados, exibir indicador vermelho no time label ou na célula.
4. Quando ALGUNS closers estão lotados, exibir indicador amarelo/parcial.

### Visual

- **Lotado total**: Fundo `bg-red-500/10`, borda `border-red-500/30`, ícone `Lock` vermelho, texto "Lotado"
- **Parcial (alguns closers cheios)**: Fundo `bg-amber-500/10`, texto "X/Y livres"
- Badge no canto do slot com contagem `2/3` leads

### Imports adicionais
- `Lock` do `lucide-react` em ambos os arquivos

