
# Plano: Relatório de Qualificação R2 (Consolidated)

## Objetivo

Criar um relatório consolidado das respostas de qualificação dos leads R2 para análise gerencial. O relatório permitirá:

1. **Para a equipe R2** (aba ao lado de No-Shows): Visualização rápida das qualificações
2. **Para Diretoria/CEOs** (em Relatórios): Análise consolidada com filtros e exportação Excel

---

## Visão Geral da Solução

```text
┌────────────────────────────────────────────────────────────────┐
│                    AGENDA R2 - Nova Aba                        │
├────────────────────────────────────────────────────────────────┤
│ Tabs: Lista | Calendário | Por Sócio | Pendentes | No-Shows | RELATÓRIO |
│                                                                │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│ │   Por Estado    │ │   Por Renda     │ │  Por Profissão  │   │
│ │  ┌───────────┐  │ │  ┌───────────┐  │ │  ┌───────────┐  │   │
│ │  │ SP: 45    │  │ │  │10k-20k:32 │  │ │  │Empresário │  │   │
│ │  │ RJ: 28    │  │ │  │20k-30k:18 │  │ │  │   :28     │  │   │
│ │  │ MG: 15    │  │ │  │ +30k: 12  │  │ │  │Engenheiro │  │   │
│ │  └───────────┘  │ │  └───────────┘  │ │  │   :22     │  │   │
│ └─────────────────┘ └─────────────────┘ └───────────────────┘   │
│                                                                │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │                  Tabela Detalhada                          │ │
│ │ Lead | Estado | Renda | Profissão | Status | Closer | ... │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                │
│                 [📊 Exportar Excel]                            │
└────────────────────────────────────────────────────────────────┘
```

---

## Componentes a Criar

### 1. Hook: `useR2QualificationReport`

Buscar dados de qualificação consolidados das reuniões R2.

**Arquivo:** `src/hooks/useR2QualificationReport.ts`

**Dados retornados:**
```typescript
interface R2QualificationReportRow {
  id: string;
  leadName: string;
  phone: string | null;
  email: string | null;
  scheduledAt: string;
  status: string;
  closerName: string;
  sdrName: string | null;
  salesChannel: 'A010' | 'LIVE';
  // Campos de qualificação
  estado: string | null;
  profissao: string | null;
  renda: string | null;
  idade: string | null;
  jaConstroi: string | null;
  terreno: string | null;
  imovel: string | null;
  tempoMcf: string | null;
  temSocio: boolean | null;
  nomeSocio: string | null;
}
```

**Query:** Buscar `meeting_slot_attendees` com JOIN em `crm_deals.custom_fields` para extrair os campos de qualificação.

### 2. Componente: `R2QualificationReportPanel`

Painel com filtros, gráficos de distribuição e tabela de dados.

**Arquivo:** `src/components/crm/R2QualificationReportPanel.tsx`

**Funcionalidades:**
- Filtros por período, closer, status
- Gráficos de distribuição (por Estado, Renda, Profissão, Terreno, Já Constrói)
- Tabela detalhada com todas as colunas
- Botão "Exportar Excel" com formato igual à planilha manual

### 3. Integração na Agenda R2

**Arquivo:** `src/pages/crm/AgendaR2.tsx`

Adicionar nova aba "Relatório" ao lado de "No-Shows".

### 4. Página para Relatórios Gerais (Opcional)

**Arquivo:** `src/pages/relatorios/QualificacaoR2.tsx`

Página acessível via menu Relatórios para Chairman/CEOs com visão consolidada completa.

---

## Detalhes Técnicos

### Hook `useR2QualificationReport.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, format } from 'date-fns';

interface QualificationFilters {
  startDate: Date;
  endDate: Date;
  closerId?: string;
  status?: string;
}

export function useR2QualificationReport(filters: QualificationFilters) {
  return useQuery({
    queryKey: ['r2-qualification-report', filters],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          scheduled_at,
          status,
          closer:closers!meeting_slots_closer_id_fkey(id, name),
          attendees:meeting_slot_attendees(
            id,
            attendee_name,
            attendee_phone,
            status,
            deal:crm_deals(
              id,
              name,
              owner_id,
              custom_fields,
              contact:crm_contacts(name, email, phone)
            )
          )
        `)
        .eq('meeting_type', 'r2')
        .gte('scheduled_at', startOfDay(filters.startDate).toISOString())
        .lte('scheduled_at', endOfDay(filters.endDate).toISOString());
      
      if (error) throw error;
      
      // Transform and flatten data
      return data.flatMap(meeting => 
        meeting.attendees.map(att => ({
          id: att.id,
          leadName: att.attendee_name || att.deal?.contact?.name,
          phone: att.attendee_phone || att.deal?.contact?.phone,
          email: att.deal?.contact?.email,
          scheduledAt: meeting.scheduled_at,
          status: att.status,
          closerName: meeting.closer?.name,
          // Qualification fields from custom_fields
          estado: att.deal?.custom_fields?.estado,
          profissao: att.deal?.custom_fields?.profissao,
          renda: att.deal?.custom_fields?.renda,
          idade: att.deal?.custom_fields?.idade,
          jaConstroi: att.deal?.custom_fields?.ja_constroi,
          terreno: att.deal?.custom_fields?.terreno,
          imovel: att.deal?.custom_fields?.possui_imovel,
          tempoMcf: att.deal?.custom_fields?.tempo_conhece_mcf,
          temSocio: att.deal?.custom_fields?.tem_socio,
          nomeSocio: att.deal?.custom_fields?.nome_socio,
        }))
      );
    }
  });
}
```

### Componente `R2QualificationReportPanel.tsx`

**Estrutura:**

```tsx
export function R2QualificationReportPanel() {
  // Filtros de período e closer
  const [dateRange, setDateRange] = useState<DateRange>();
  const [closerFilter, setCloserFilter] = useState('all');
  
  const { data = [], isLoading } = useR2QualificationReport({
    startDate: dateRange?.from || startOfMonth(new Date()),
    endDate: dateRange?.to || endOfMonth(new Date()),
    closerId: closerFilter !== 'all' ? closerFilter : undefined,
  });
  
  // Agregações para gráficos
  const estadoStats = useMemo(() => 
    groupBy(data, 'estado'), [data]
  );
  const rendaStats = useMemo(() => 
    groupBy(data, 'renda'), [data]
  );
  
  // Exportar Excel
  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(data.map(row => ({
      'Nome': row.leadName,
      'Telefone': row.phone,
      'Email': row.email,
      'Data Reunião': format(new Date(row.scheduledAt), 'dd/MM/yyyy'),
      'Horário': format(new Date(row.scheduledAt), 'HH:mm'),
      'Status': row.status,
      'Sócio R2': row.closerName,
      'Estado': row.estado,
      'Profissão': row.profissao,
      'Renda': row.renda,
      'Idade': row.idade,
      'Já Constrói': row.jaConstroi,
      'Tem Terreno': row.terreno,
      'Tem Imóvel': row.imovel,
      'Conhece MCF': row.tempoMcf,
      'Tem Sócio': row.temSocio ? 'Sim' : 'Não',
      'Nome Sócio': row.nomeSocio,
    })));
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Qualificação R2');
    XLSX.writeFile(wb, `qualificacao_r2_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };
  
  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <DatePickerCustom mode="range" ... />
            <Select value={closerFilter} ... />
            <Button onClick={handleExport}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Gráficos de Distribuição */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle>Por Estado</CardTitle></CardHeader>
          <CardContent>
            <PieChart ... />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader><CardTitle>Por Renda</CardTitle></CardHeader>
          <CardContent>
            <BarChart ... />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader><CardTitle>Por Profissão</CardTitle></CardHeader>
          <CardContent>
            <BarChart ... />
          </CardContent>
        </Card>
      </div>
      
      {/* Tabela Detalhada */}
      <Card>
        <Table>
          <TableHeader>...</TableHeader>
          <TableBody>
            {data.map(row => <TableRow key={row.id}>...</TableRow>)}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
```

### Integração na AgendaR2.tsx

Adicionar nova TabTrigger e TabsContent:

```tsx
// No TabsList (após No-Shows)
<TabsTrigger value="report" className="gap-2">
  <FileText className="h-4 w-4" />
  Relatório
</TabsTrigger>

// Novo TabsContent
<TabsContent value="report" className="mt-0">
  <R2QualificationReportPanel />
</TabsContent>
```

---

## Colunas do Relatório (baseado na planilha)

| Coluna | Campo | Origem |
|--------|-------|--------|
| Nome | `attendee_name` | meeting_slot_attendees |
| Email | `email` | crm_contacts |
| Telefone | `attendee_phone` | meeting_slot_attendees |
| Responsável (SDR) | `owner_id` | crm_deals |
| Sócio R2 | `closer.name` | closers |
| Status Agendamento | `status` | meeting_slot_attendees |
| Status Yanca | customizado | custom_fields |
| Vendas | vinculado | hubla_transactions |
| Idade | `custom_fields.idade` | crm_deals |
| Renda | `custom_fields.renda` | crm_deals |
| Estado | `custom_fields.estado` | crm_deals |
| Profissão | `custom_fields.profissao` | crm_deals |
| Constrói | `custom_fields.ja_constroi` | crm_deals |
| Tem Sócio | `custom_fields.tem_socio` | crm_deals |
| Imóvel Próprio | `custom_fields.possui_imovel` | crm_deals |
| Tem Terreno | `custom_fields.terreno` | crm_deals |
| Conhece MCF | `custom_fields.tempo_conhece_mcf` | crm_deals |

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/hooks/useR2QualificationReport.ts` | **Criar** - Hook para buscar dados consolidados |
| `src/components/crm/R2QualificationReportPanel.tsx` | **Criar** - Painel com gráficos e tabela |
| `src/pages/crm/AgendaR2.tsx` | **Modificar** - Adicionar aba "Relatório" |
| `src/pages/relatorios/QualificacaoR2.tsx` | **Criar** (opcional) - Página para menu Relatórios |

---

## Acesso por Roles

| Localização | Roles com Acesso |
|-------------|------------------|
| Agenda R2 > Aba Relatório | `admin`, `manager`, `coordenador`, `closer` (sócio R2) |
| Relatórios > Qualificação R2 | `admin`, `manager` (Chairman, CEOs) |

---

## Resultado Esperado

1. **Nova aba "Relatório"** na Agenda R2 ao lado de "No-Shows"
2. **Gráficos de distribuição** mostrando estados mais frequentes, faixas de renda, profissões
3. **Tabela completa** com todos os dados de qualificação
4. **Exportação Excel** no mesmo formato da planilha manual
5. **Filtros** por período, closer, status para análise segmentada

