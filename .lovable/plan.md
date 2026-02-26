

## Plano: Traduzir status das reuniões para português legível

### Problema
Os status vêm do banco em inglês (`invited`, `completed`, `no_show`, `contract_paid`, `rescheduled`) e são exibidos assim na UI.

### Solução
Criar uma função `formatMeetingStatus(status)` e aplicá-la em todos os pontos de exibição.

**Mapeamento:**
- `invited` → `Agendado`
- `completed` → `Realizada`
- `no_show` → `No-show`
- `contract_paid` → `Contrato Pago`
- `rescheduled` → `Reagendado`
- `scheduled` → `Agendado`
- `cancelled` → `Cancelado`
- Fallback: retorna o valor original

### Arquivos a alterar

**1. `src/components/sdr/SdrLeadsTable.tsx`**
- Adicionar função `formatMeetingStatus`
- Atualizar `getStatusBadgeClass` para reconhecer status em inglês
- Substituir `{meeting.status_atual}` por `{formatMeetingStatus(meeting.status_atual)}`
- Traduzir opções do filtro de status no dropdown

**2. `src/components/sdr/SdrMeetingActionsDrawer.tsx`**
- Aplicar `formatMeetingStatus` na linha 120 onde exibe `{meeting.status_atual}`

**3. `src/components/sdr/SelectedSdrLeadsPanel.tsx`**
- Aplicar tradução nos filtros e na exportação CSV

**4. `src/components/sdr/MeetingsTable.tsx`**
- Aplicar tradução onde exibe o status

A função pode ser criada em um arquivo utilitário compartilhado ou inline em cada componente (prefiro utilitário para consistência).

