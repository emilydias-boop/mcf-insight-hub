

# Plano: Filtrar Agenda R1 por Business Unit

## Problema Atual

A Agenda R1 do Consórcio está exibindo reuniões de todas as BUs (Incorporador, etc.) porque:

1. O hook `useAgendaMeetings` **não filtra por BU** - busca todas as reuniões de R1 do período
2. Os closers já são filtrados por BU via `useClosersWithAvailability(activeBU)`, mas as reuniões não
3. Não existem closers cadastrados com `bu = 'consorcio'` na tabela `closers`

---

## Solução em Duas Partes

### Parte 1: Modificar o Hook para Filtrar Reuniões por BU

Modificar `useAgendaMeetings` para aceitar um parâmetro opcional `closerIds` e filtrar as reuniões apenas para esses closers.

**Arquivo:** `src/hooks/useAgendaData.ts`

```typescript
export function useAgendaMeetings(
  startDate: Date, 
  endDate: Date, 
  meetingType: 'r1' | 'r2' | 'all' = 'r1',
  closerIds?: string[] // NOVO: IDs dos closers da BU
) {
  return useQuery({
    queryKey: ['agenda-meetings', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd'), meetingType, closerIds],
    queryFn: async () => {
      let query = supabase
        .from('meeting_slots')
        .select(`...`)
        .gte('scheduled_at', startDate.toISOString())
        .lte('scheduled_at', endDate.toISOString());
      
      if (meetingType !== 'all') {
        query = query.eq('meeting_type', meetingType);
      }
      
      // NOVO: Filtrar por closers específicos (da BU)
      if (closerIds && closerIds.length > 0) {
        query = query.in('closer_id', closerIds);
      }
      
      // ... resto do código
    },
  });
}
```

### Parte 2: Passar os IDs dos Closers da BU na Agenda

**Arquivo:** `src/pages/crm/Agenda.tsx`

```typescript
// Buscar closers da BU primeiro
const { data: closers = [], isLoading: closersLoading } = useClosersWithAvailability(activeBU);

// Extrair IDs dos closers para filtrar reuniões
const closerIds = useMemo(() => closers.map(c => c.id), [closers]);

// Passar os IDs para filtrar apenas reuniões desses closers
const { data: meetings = [], isLoading: meetingsLoading, refetch } = useAgendaMeetings(
  rangeStart, 
  rangeEnd, 
  'r1', 
  closerIds.length > 0 ? closerIds : undefined
);
```

---

## Configuração de Dados (Manual via UI)

Você precisará cadastrar os closers do Consórcio em **CRM → Configurações → Closers R1**:

| Nome | Email | BU |
|------|-------|----|
| João Pedro | joao.pedro@minhacasafinanciada.com | consorcio |
| Luis Felipe | luis.felipe@minhacasafinanciada.com | consorcio |
| Thobson | thobson.motta@minhacasafinanciada.com | consorcio |
| Victoria Paz | victoria.paz@minhacasafinanciada.com | consorcio |

Os SDRs (Ithaline, Cleiton, Igor) não precisam estar na tabela `closers` - eles agendam via a interface, não recebem leads.

---

## Fluxo de Dados Corrigido

```text
┌─────────────────────────────────────────────────────────────────────┐
│  /consorcio/crm/agenda                                              │
│  activeBU = 'consorcio'                                             │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  useClosersWithAvailability('consorcio')                            │
│  Retorna: [João Pedro, Luis, Thobson, Victoria]                     │
│  IDs: ['abc123', 'def456', 'ghi789', 'jkl012']                     │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  useAgendaMeetings(start, end, 'r1', ['abc123','def456',...])       │
│  SQL: WHERE meeting_type = 'r1'                                     │
│        AND closer_id IN ('abc123', 'def456', 'ghi789', 'jkl012')   │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Resultado: Apenas reuniões dos closers do Consórcio                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useAgendaData.ts` | Adicionar parâmetro `closerIds` ao `useAgendaMeetings` e filtrar query |
| `src/pages/crm/Agenda.tsx` | Passar `closerIds` extraídos dos closers da BU para o hook |
| `src/pages/crm/AgendaMetricas.tsx` | Atualizar chamada para passar `closerIds` (manter consistência) |

---

## Resultado Esperado

Após a implementação:

| CRM | Closers Visíveis | Reuniões Visíveis |
|-----|-----------------|-------------------|
| `/consorcio/crm/agenda` | João Pedro, Luis, Thobson, Victoria | Apenas reuniões com esses closers |
| `/crm/agenda` (Incorporador) | Julio, Cristiane, Thayna, etc. | Apenas reuniões com closers do Incorporador |
| `/leilao/crm/agenda` | Closers cadastrados com bu='leilao' | Apenas reuniões com closers do Leilão |

---

## Próximos Passos Após Implementação

1. **Cadastrar Closers**: Ir em `/consorcio/crm/configuracoes` → Closers e adicionar João Pedro, Luis, Thobson, Victoria com `bu = 'consorcio'`

2. **Verificar SDRs**: Os SDRs Ithaline e Cleiton já estão no sistema com `squad = 'consorcio'`. O Igor precisará ser criado via Admin → Usuários

