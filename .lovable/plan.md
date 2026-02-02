
# Plano: Integração de Agendas Multi-BU para Closers

## Cenário Atual

### Luis Felipe
- **Role**: Manager (Consórcio)
- **Situação**: Não tem registro na tabela `closers` ainda
- **Necessidade**: Fazer reuniões R1/R2 no Consórcio E outras BUs

### Thobson
- **Role**: Coordenador (Incorporador)
- **Registro atual**: 1 closer na tabela `closers` (bu=incorporador, meeting_type=r2)
- **Reuniões existentes**: 10 reuniões R2 agendadas
- **Necessidade**: Fazer R2 do Incorporador E reuniões de outras BUs (ex: Consórcio)

## Problema Principal

Atualmente, um closer só pode pertencer a **uma BU**. Se Thobson atende Consórcio e Incorporador, quando ele tem uma reunião às 09:00 no Incorporador, esse horário deveria aparecer como **ocupado** na agenda do Consórcio, mas não aparece porque são registros separados.

---

## Solução Proposta

### Arquitetura: Multi-BU por Closer (Vinculação por employee_id)

Em vez de criar múltiplos registros de closer para a mesma pessoa, a solução usa o `employee_id` como identificador único do usuário para verificar conflitos de agenda entre todas as BUs.

```text
┌─────────────────────────────────────────────────────────────────────┐
│  TABELA closers                                                      │
│                                                                     │
│  id: closer-1                                                       │
│  name: Thobson Motta                                                │
│  bu: incorporador                                                   │
│  employee_id: aa7a...  ◄──── Identificador único do funcionário     │
│                                                                     │
│  id: closer-2                                                       │
│  name: Thobson Motta (Consórcio)                                   │
│  bu: consorcio                                                      │
│  employee_id: aa7a...  ◄──── MESMO employee_id                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  VERIFICAÇÃO DE CONFLITO                                            │
│                                                                     │
│  Ao agendar no Consórcio às 09:00:                                 │
│  1. Buscar employee_id do closer selecionado                        │
│  2. Buscar TODOS os closers com o mesmo employee_id                │
│  3. Verificar meeting_slots de todos esses closers                  │
│  4. Se houver reunião às 09:00 em QUALQUER BU → slot ocupado       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Alterações Necessárias

### 1. Tabela closers - Adicionar registros multi-BU

Para Thobson e Luis, criar registros adicionais com o **mesmo employee_id** para cada BU que atuam:

| Closer | BU | meeting_type | employee_id |
|--------|-----|--------------|-------------|
| Thobson Motta | incorporador | r2 | aa7a7860-... |
| Thobson Motta | consorcio | r1 | aa7a7860-... (MESMO) |
| Luis Felipe | consorcio | r1 | (employee do Luis) |
| Luis Felipe | credito | r2 | (MESMO employee) |

### 2. Hook: useCloserConflicts

**Arquivo:** `src/hooks/useCloserConflicts.ts` (novo)

Criar hook para verificar conflitos de agenda entre closers com o mesmo employee_id:

```typescript
// Verifica se há reuniões de qualquer closer com o mesmo employee_id
export function useCloserConflicts(closerId: string, date: Date) {
  return useQuery({
    queryKey: ['closer-conflicts', closerId, format(date, 'yyyy-MM-dd')],
    queryFn: async () => {
      // 1. Buscar employee_id do closer
      const { data: closer } = await supabase
        .from('closers')
        .select('employee_id')
        .eq('id', closerId)
        .single();
      
      if (!closer?.employee_id) return { conflictingTimes: [] };
      
      // 2. Buscar todos os closers com mesmo employee_id
      const { data: relatedClosers } = await supabase
        .from('closers')
        .select('id')
        .eq('employee_id', closer.employee_id);
      
      const closerIds = relatedClosers?.map(c => c.id) || [];
      
      // 3. Buscar reuniões de todos esses closers na data
      const { data: meetings } = await supabase
        .from('meeting_slots')
        .select('scheduled_at, duration_minutes')
        .in('closer_id', closerIds)
        .gte('scheduled_at', `${format(date, 'yyyy-MM-dd')}T00:00:00`)
        .lte('scheduled_at', `${format(date, 'yyyy-MM-dd')}T23:59:59`)
        .in('status', ['scheduled', 'rescheduled']);
      
      return {
        conflictingTimes: meetings?.map(m => ({
          start: new Date(m.scheduled_at),
          end: new Date(new Date(m.scheduled_at).getTime() + (m.duration_minutes || 30) * 60000)
        })) || []
      };
    }
  });
}
```

### 3. Modificar getAvailableClosersForSlot

**Arquivo:** `src/components/crm/AgendaCalendar.tsx`

Adicionar verificação de conflitos cruzados:

```typescript
// No componente, adicionar lógica para verificar conflitos
const getAvailableClosersForSlot = useCallback((day: Date, hour: number, minute: number) => {
  // ... código existente ...
  
  // NOVO: Filtrar também por conflitos de outros closers do mesmo employee
  return configuredCloserIds.filter(closerId => {
    const hasMeeting = /* verificação atual */;
    
    // Verificar conflitos cross-BU via employee_id
    const hasConflict = crossBuConflicts.some(conflict => 
      conflict.closerId === closerId && conflict.time === timeStr
    );
    
    return !hasMeeting && !hasConflict;
  });
}, [/* deps */]);
```

### 4. Modificar useR2CloserAvailableSlots

**Arquivo:** `src/hooks/useR2CloserAvailableSlots.ts`

Adicionar verificação de reuniões de outros closers com mesmo employee_id:

```typescript
// 4.1 Buscar employee_id e closers relacionados
const { data: closerData } = await supabase
  .from('closers')
  .select('employee_id, max_leads_per_slot')
  .eq('id', closerId)
  .single();

// 4.2 Se tem employee_id, buscar reuniões de TODOS closers relacionados
let allMeetings = [];
if (closerData?.employee_id) {
  const { data: relatedClosers } = await supabase
    .from('closers')
    .select('id')
    .eq('employee_id', closerData.employee_id);
  
  const relatedIds = relatedClosers?.map(c => c.id) || [];
  
  const { data: allRelatedMeetings } = await supabase
    .from('meeting_slots')
    .select('scheduled_at')
    .in('closer_id', relatedIds)
    .gte('scheduled_at', startOfDayStr)
    .lte('scheduled_at', endOfDayStr);
  
  allMeetings = allRelatedMeetings || [];
}
```

### 5. Atualizar CloserFormDialog para Multi-BU

**Arquivo:** `src/components/crm/CloserFormDialog.tsx`

Adicionar aviso quando criar closer de usuário que já existe em outra BU:

```typescript
// Verificar se usuário já tem registro de closer em outra BU
const existingClosers = useQuery({
  queryKey: ['existing-closers-for-employee', formData.employee_id],
  queryFn: async () => {
    if (!formData.employee_id) return [];
    const { data } = await supabase
      .from('closers')
      .select('id, name, bu, meeting_type')
      .eq('employee_id', formData.employee_id);
    return data || [];
  }
});

// Mostrar aviso se houver closers existentes
{existingClosers.data?.length > 0 && (
  <Alert>
    <Info className="h-4 w-4" />
    <AlertDescription>
      Este usuário já é closer em: {existingClosers.data.map(c => c.bu).join(', ')}.
      A agenda será integrada automaticamente (horários ocupados em uma BU aparecerão como indisponíveis nas outras).
    </AlertDescription>
  </Alert>
)}
```

---

## Fluxo de Uso Esperado

```text
┌─────────────────────────────────────────────────────────────────────┐
│  CENÁRIO: Thobson tem R2 às 09:00 no Incorporador                   │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SDR do Consórcio abre Agenda R1                                    │
│  Vai agendar reunião às 09:00 com Thobson                          │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Sistema detecta:                                                    │
│  1. Thobson (Consórcio) tem employee_id = aa7a...                  │
│  2. Thobson (Incorporador) também tem employee_id = aa7a...        │
│  3. Há reunião R2 às 09:00 do Thobson (Incorporador)              │
│                                                                     │
│  RESULTADO: Slot 09:00 aparece como OCUPADO                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useCloserConflicts.ts` | Novo hook para verificar conflitos cross-BU |
| `src/hooks/useR2CloserAvailableSlots.ts` | Adicionar verificação de reuniões de closers relacionados |
| `src/hooks/useCloserMeetingLinks.ts` | Incluir lógica de conflitos no useUniqueSlotsForDays |
| `src/components/crm/AgendaCalendar.tsx` | Usar conflitos no getAvailableClosersForSlot |
| `src/components/crm/CloserFormDialog.tsx` | Aviso de integração quando employee já é closer |

---

## Passo Inicial: Configuração de Dados

Antes de implementar o código, será necessário:

1. **Cadastrar Luis Felipe como closer** no Consórcio (ele já tem role=manager, mas precisa de role=closer também OU o dropdown precisa incluir managers)

2. **Criar registro adicional para Thobson no Consórcio**:
   - Nome: "Thobson Motta"
   - BU: consorcio
   - meeting_type: r1 (ou o tipo desejado)
   - employee_id: aa7a7860-39cb-4014-b831-297ad72f3b48 (MESMO do registro existente)

---

## Benefícios

1. **Sem duplicação de agendamentos**: Horário ocupado em uma BU bloqueia nas outras
2. **Flexibilidade**: Mesma pessoa pode ter configurações diferentes por BU
3. **Transparência**: SDRs veem claramente quando o closer está indisponível
4. **Manutenção**: Cada BU gerencia sua própria agenda do closer
