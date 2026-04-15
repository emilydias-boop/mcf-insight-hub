

## Plano: Exportar dados da Agenda R1 com filtros aplicados

### O que será feito
Adicionar um botão "Exportar Excel" na página da Agenda R1 que exporta os dados visíveis (após filtros de closer, status, busca e período) em formato `.xlsx`.

### Alterações

**`src/pages/crm/Agenda.tsx`**
1. Importar `Download` do lucide-react e `xlsx`
2. Adicionar função `handleExportExcel` que:
   - Usa `filteredMeetings` (já expandido em attendee rows, mesma lógica do `MeetingsList`)
   - Monta colunas: Data/Hora, Lead, Telefone, Closer, Status
   - Formata datas em pt-BR e traduz status para labels legíveis
   - Gera e baixa arquivo `.xlsx` com nome `agenda-r1-{data}.xlsx`
3. Adicionar botão "Exportar" ao lado dos botões existentes no header (entre Refresh e Métricas)

### Seção técnica

```ts
// Dentro de Agenda.tsx
const handleExportExcel = () => {
  const rows = [];
  for (const meeting of filteredMeetings) {
    for (const att of (meeting.attendees || [])) {
      if (att.is_partner) continue;
      rows.push({
        'Data/Hora': format(parseISO(meeting.scheduled_at), 'dd/MM/yyyy HH:mm'),
        'Lead': att.attendee_name || att.contact?.name || '',
        'Telefone': att.attendee_phone || att.contact?.phone || '',
        'Closer': meeting.closer?.name || '',
        'Status': STATUS_LABELS[att.status] || att.status,
      });
    }
  }
  // XLSX export
};
```

Nenhum componente novo — apenas a lógica de export e o botão na página existente.

