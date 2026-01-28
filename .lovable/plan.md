

# Adicionar Filtros Completos na Tab "Todas R2s"

## Objetivo

Adicionar ao componente `R2AgendadasList` os mesmos filtros e funcionalidades que existem no `R2AprovadosList`, MAIS os filtros específicos solicitados:

| Funcionalidade | Descrição |
|----------------|-----------|
| Busca por nome | Campo de pesquisa por nome, telefone ou email |
| Filtro de Closer | Dropdown para filtrar por closer específico |
| Filtro de Data | Dropdown para filtrar por dia da semana |
| **Filtro de Status R2** | Dropdown para filtrar por status de avaliação (Aprovado, Pendente, Em Análise, etc.) |
| **Filtro de Posição** | Dropdown para filtrar por posição da reunião (Realizada, No-show, Agendada) |
| Copiar Relatório | Botão para copiar lista em formato texto |
| Exportar CSV | Botão para baixar planilha Excel |
| Limpar Filtros | Botão para resetar todos os filtros |

---

## Layout Final Esperado

```text
+-------------------------------------------------------------------------------------------+
| [61 R2s na semana]                                          [Copiar Relatório] [Exportar] |
|                                                                                           |
| [Buscar...] [Todos Closers ▼] [Todas Datas ▼] [Todos Status ▼] [Todas Posições ▼] [Limpar] |
|                                                                                           |
| Segunda-Feira, 26 De Janeiro                                                         [9]  |
| +----------------------------------------------------------------------------------------+|
| | Horário | Nome Lead | Closer R2 | Dia R1 | Status                                     ||
| +----------------------------------------------------------------------------------------+|
```

---

## Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/crm/R2AgendadasList.tsx` | Adicionar estados, filtros, busca, exportação e filtros de status/posição |

---

## Detalhes Técnicos

### 1. Novos Estados

```typescript
const [searchTerm, setSearchTerm] = useState('');
const [closerFilter, setCloserFilter] = useState<string>('all');
const [dateFilter, setDateFilter] = useState<string>('all');
const [statusFilter, setStatusFilter] = useState<string>('all');      // Status R2 (Aprovado, Pendente, etc)
const [positionFilter, setPositionFilter] = useState<string>('all');  // Posição (Realizada, No-show, Agendada)
const [copied, setCopied] = useState(false);
```

### 2. Listas para os Dropdowns

**Closers únicos:**
```typescript
const closers = useMemo(() => {
  const uniqueClosers = new Map<string, { id: string; name: string; color: string | null }>();
  attendees.forEach(att => {
    if (att.closer_id && att.closer_name) {
      uniqueClosers.set(att.closer_id, { id: att.closer_id, name: att.closer_name, color: att.closer_color });
    }
  });
  return Array.from(uniqueClosers.values());
}, [attendees]);
```

**Datas únicas:**
```typescript
const meetingDates = useMemo(() => {
  const uniqueDates = new Set<string>();
  attendees.forEach(att => uniqueDates.add(format(new Date(att.scheduled_at), 'yyyy-MM-dd')));
  return Array.from(uniqueDates).sort();
}, [attendees]);
```

**Status R2 únicos (Aprovado, Pendente, Em Análise, etc):**
```typescript
const r2Statuses = useMemo(() => {
  const unique = new Map<string, string>();
  attendees.forEach(att => {
    if (att.r2_status_id && att.r2_status_name) {
      unique.set(att.r2_status_id, att.r2_status_name);
    }
  });
  return Array.from(unique.entries()).map(([id, name]) => ({ id, name }));
}, [attendees]);
```

**Posições da reunião (Realizada, No-show, Agendada):**
```typescript
const POSITION_OPTIONS = [
  { value: 'scheduled', label: 'Agendada' },
  { value: 'completed', label: 'Realizada' },
  { value: 'no_show', label: 'No-show' },
  { value: 'contract_paid', label: 'Contrato Pago' },
];
```

### 3. Lógica de Filtragem

```typescript
const filteredAttendees = useMemo(() => {
  return attendees.filter(att => {
    // Busca por nome/telefone/email
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const name = (att.attendee_name || att.deal_name || '').toLowerCase();
      const phone = (att.attendee_phone || att.contact_phone || '').replace(/\D/g, '');
      const email = (att.contact_email || '').toLowerCase();
      const searchNormalized = search.replace(/\D/g, '');
      
      if (!name.includes(search) && 
          !(searchNormalized.length > 0 && phone.includes(searchNormalized)) && 
          !email.includes(search)) {
        return false;
      }
    }
    
    // Filtro de Closer
    if (closerFilter !== 'all' && att.closer_id !== closerFilter) return false;
    
    // Filtro de Data
    if (dateFilter !== 'all') {
      if (format(new Date(att.scheduled_at), 'yyyy-MM-dd') !== dateFilter) return false;
    }
    
    // Filtro de Status R2 (Aprovado, Pendente, etc)
    if (statusFilter !== 'all' && att.r2_status_id !== statusFilter) return false;
    
    // Filtro de Posição (Realizada, No-show, Agendada)
    if (positionFilter !== 'all' && att.status !== positionFilter) return false;
    
    return true;
  });
}, [attendees, searchTerm, closerFilter, dateFilter, statusFilter, positionFilter]);
```

### 4. Interface dos Filtros

```tsx
{/* Filtros */}
<div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-wrap">
  {/* Busca */}
  <div className="relative flex-1 max-w-md">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
  </div>
  
  {/* Closer */}
  <Select value={closerFilter} onValueChange={setCloserFilter}>
    <SelectTrigger className="w-[160px]"><SelectValue placeholder="Closer" /></SelectTrigger>
    <SelectContent>
      <SelectItem value="all">Todos Closers</SelectItem>
      {closers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
    </SelectContent>
  </Select>
  
  {/* Data */}
  <Select value={dateFilter} onValueChange={setDateFilter}>
    <SelectTrigger className="w-[140px]"><SelectValue placeholder="Data" /></SelectTrigger>
    <SelectContent>
      <SelectItem value="all">Todas Datas</SelectItem>
      {meetingDates.map(d => <SelectItem key={d} value={d}>{format(...)}</SelectItem>)}
    </SelectContent>
  </Select>
  
  {/* Status R2 (Aprovado, Pendente, etc) */}
  <Select value={statusFilter} onValueChange={setStatusFilter}>
    <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
    <SelectContent>
      <SelectItem value="all">Todos Status</SelectItem>
      {r2Statuses.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
    </SelectContent>
  </Select>
  
  {/* Posição (Realizada, No-show, Agendada) */}
  <Select value={positionFilter} onValueChange={setPositionFilter}>
    <SelectTrigger className="w-[140px]"><SelectValue placeholder="Posição" /></SelectTrigger>
    <SelectContent>
      <SelectItem value="all">Todas Posições</SelectItem>
      {POSITION_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
    </SelectContent>
  </Select>
  
  {/* Limpar */}
  {hasActiveFilters && (
    <Button variant="ghost" size="sm" onClick={clearFilters}>
      <XCircle className="h-4 w-4 mr-1" /> Limpar
    </Button>
  )}
</div>
```

### 5. Funções de Exportação

**Copiar Relatório:**
```typescript
const generateReport = () => {
  let report = `*R2s da Semana*\n\nTotal: ${filteredAttendees.length}\n\n`;
  filteredAttendees.forEach(att => {
    const name = att.attendee_name || att.deal_name || 'Sem nome';
    const phone = att.attendee_phone || att.contact_phone || '-';
    const closer = att.closer_name || '-';
    const dateTime = format(new Date(att.scheduled_at), 'dd/MM HH:mm');
    const status = att.r2_status_name || att.status || '-';
    report += `${name}\t${phone}\t${closer}\t${dateTime}\t${status}\n`;
  });
  return report;
};
```

**Exportar CSV:**
```typescript
const handleExportCSV = () => {
  const headers = ['Nome', 'Telefone', 'Closer', 'Data/Hora', 'Status R2', 'Posição'];
  const rows = filteredAttendees.map(att => [
    att.attendee_name || att.deal_name || 'Sem nome',
    att.attendee_phone || att.contact_phone || '-',
    att.closer_name || '-',
    format(new Date(att.scheduled_at), 'dd/MM/yyyy HH:mm'),
    att.r2_status_name || '-',
    STATUS_LABELS[att.status]?.label || att.status || '-',
  ]);
  // ... gerar e baixar CSV
};
```

---

## Resultado Esperado

| Filtro | Opções |
|--------|--------|
| **Busca** | Nome, telefone, email |
| **Closer** | Claudia Carielo, Thobson Motta, Jessica Bellini, etc. |
| **Data** | 26/01 (Dom), 27/01 (Seg), 28/01 (Ter), etc. |
| **Status R2** | Aprovado, Pendente, Em Análise, Reprovado, Desistente, etc. |
| **Posição** | Agendada, Realizada, No-show, Contrato Pago |

Exemplo de uso:
- Ver apenas **Realizadas** que estão **Pendentes** de avaliação
- Ver apenas **No-shows** do closer **Thobson**
- Buscar lead específico por nome ou telefone

