

## Problema

O botão "Exportar Lista" sempre exporta `filteredMeetings` (todas as reuniões R2 do período), independente da aba ativa. Quando o usuário está na aba **Pendentes** (que usa dados do `R2PendingLeadsPanel` com sua própria query `useR2PendingLeads`), a exportação não reflete o que está na tela.

O mesmo problema ocorre para a aba **No-Shows** (`R2NoShowsPanel`).

## Correção

### 1. Tornar a exportação sensível à aba ativa (`AgendaR2.tsx`)

Alterar `handleExportList` para verificar `activeTab` e exportar dados diferentes conforme a aba:

- **`list` / `calendar` / `closer`**: Exportar `filteredMeetings` (comportamento atual)
- **`pending`**: Exportar os dados de `useR2PendingLeads` (leads com Contrato Pago aguardando R2)
- **`noshows`**: Exportar os dados do painel de No-Shows

### 2. Expor dados de Pendentes para exportação

O hook `useR2PendingLeads` já é chamado internamente pelo `R2PendingLeadsPanel`. Para que o `AgendaR2.tsx` tenha acesso a esses dados sem duplicar a query, chamar o hook diretamente no `AgendaR2.tsx` (React Query deduplica automaticamente queries com a mesma key).

### 3. Lógica do `handleExportList`

```typescript
const handleExportList = () => {
  if (activeTab === 'pending') {
    // Exportar pendingLeads com colunas: Nome, Telefone, Closer R1, Data R1, Tempo
    const headers = ['Nome', 'Telefone', 'Closer R1', 'Data R1', 'Status'];
    const rows = pendingLeads.map(lead => [
      lead.attendee_name || 'Sem nome',
      lead.attendee_phone || '-',
      lead.closer_name || '-',
      lead.scheduled_at ? format(...) : '-',
      'Contrato Pago'
    ]);
    // ... gerar CSV
  } else if (activeTab === 'noshows') {
    // Exportar no-shows
  } else {
    // Exportar filteredMeetings (atual)
  }
};
```

### Resultado
- "Exportar Lista" exportará exatamente o que o usuário está vendo na aba ativa
- Pendentes exportará a lista de leads com Contrato Pago aguardando R2
- No-Shows exportará os no-shows visíveis

