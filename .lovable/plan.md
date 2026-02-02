

# Plano: Filtrar Slots de Disponibilidade por BU

## Problema Identificado

A Agenda R1 do Consórcio está mostrando os **horários de disponibilidade** (slots "+Closer", "+C") de closers de **todas as BUs** porque o hook `useUniqueSlotsForDays` não filtra por Business Unit.

Na imagem, os slots mostrados (como às 10:15, 09:00) pertencem a closers do Incorporador, não do Consórcio.

## Causa Raiz

O hook `useUniqueSlotsForDays` em `src/hooks/useCloserMeetingLinks.ts`:
- Busca closers ativos apenas por `meeting_type`
- **Não filtra por BU**
- Retorna slots de `closer_meeting_links` de todos os closers R1

```typescript
// Código atual (sem filtro de BU)
const { data: closerIds } = await supabase
  .from('closers')
  .select('id')
  .eq('is_active', true)
  .or('meeting_type.is.null,meeting_type.eq.r1');  // ← Sem filtro de BU!
```

---

## Solução

Modificar o sistema para que apenas os slots dos closers da BU ativa sejam exibidos.

### Alteração 1: Hook `useUniqueSlotsForDays`

Adicionar parâmetro opcional `closerIds` para permitir que o componente passe os IDs dos closers da BU:

```typescript
// Arquivo: src/hooks/useCloserMeetingLinks.ts

export function useUniqueSlotsForDays(
  daysOfWeek: number[], 
  meetingType: 'r1' | 'r2' = 'r1',
  closerIdsFilter?: string[] // NOVO: IDs dos closers da BU
) {
  return useQuery({
    queryKey: ['unique-slots-for-days', daysOfWeek, meetingType, closerIdsFilter],
    queryFn: async () => {
      let ids: string[];
      
      // Se closerIdsFilter foi fornecido, usar esses IDs
      if (closerIdsFilter && closerIdsFilter.length > 0) {
        ids = closerIdsFilter;
      } else {
        // Fallback: buscar todos os closers do tipo (comportamento atual)
        const { data: closerIds, error } = await supabase
          .from('closers')
          .select('id')
          .eq('is_active', true)
          .or(meetingType === 'r1' 
            ? 'meeting_type.is.null,meeting_type.eq.r1' 
            : 'meeting_type.eq.r2');

        if (error) throw error;
        ids = closerIds?.map(c => c.id) || [];
      }
      
      if (ids.length === 0) return {};

      // Buscar slots apenas desses closers
      const { data, error } = await supabase
        .from('closer_meeting_links')
        .select('day_of_week, start_time, closer_id')
        .in('day_of_week', daysOfWeek)
        .in('closer_id', ids)  // ← Agora filtra por closers específicos
        .order('start_time');

      // ... resto do código igual
    },
  });
}
```

### Alteração 2: Componente `AgendaCalendar`

Passar os IDs dos closers da BU para o hook:

```typescript
// Arquivo: src/components/crm/AgendaCalendar.tsx

// Extrair IDs dos closers recebidos (já filtrados por BU)
const closerIdsForSlots = useMemo(() => closers.map(c => c.id), [closers]);

// Passar para o hook de slots
const { data: meetingLinkSlots } = useUniqueSlotsForDays(
  daysOfWeekInView, 
  'r1',
  closerIdsForSlots  // NOVO: passa IDs dos closers da BU
);
```

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────┐
│  /consorcio/crm/agenda                                              │
│  activeBU = 'consorcio'                                             │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  useClosersWithAvailability('consorcio')                            │
│  Retorna: [João Pedro, Victoria Paz]                                │
│  IDs: ['abc123', 'def456']                                          │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  AgendaCalendar recebe closers = [João Pedro, Victoria Paz]         │
│  Extrai: closerIds = ['abc123', 'def456']                          │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  useUniqueSlotsForDays(daysOfWeek, 'r1', ['abc123', 'def456'])     │
│  SQL: WHERE closer_id IN ('abc123', 'def456')                       │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Resultado: Apenas slots de João Pedro e Victoria Paz               │
│  (Closers do Consórcio)                                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useCloserMeetingLinks.ts` | Adicionar parâmetro `closerIdsFilter` ao `useUniqueSlotsForDays` |
| `src/components/crm/AgendaCalendar.tsx` | Passar IDs dos closers recebidos para o hook |

---

## Resultado Esperado

| CRM | Slots Visíveis |
|-----|----------------|
| `/consorcio/crm/agenda` | Apenas slots de closers com `bu = 'consorcio'` |
| `/crm/agenda` (Incorporador) | Apenas slots de closers com `bu = 'incorporador'` |
| `/leilao/crm/agenda` | Apenas slots de closers com `bu = 'leilao'` |

---

## Nota sobre Dependência

Para que essa filtragem funcione corretamente, é necessário que os closers tenham sido cadastrados com a **BU correta**. Se João Pedro e Victoria aparecem na legenda do Consórcio (como mostrado na imagem), significa que estão corretamente configurados.

