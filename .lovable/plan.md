

## Controle Diego: Kanban com Drag & Drop

### Mudança principal
Substituir a tabela atual por um layout Kanban de 2 colunas (Pendentes / Enviados) com drag-and-drop nativo usando a biblioteca `@hello-pangea/dnd` (fork mantido do `react-beautiful-dnd`, já compatível com React 18+).

### Estrutura visual

```text
┌──────────────────────────┐  ┌──────────────────────────┐
│ 🟠 Pendentes (152)       │  │ 🟢 Enviados (22)          │
│──────────────────────────│  │──────────────────────────│
│ ┌──────────────────────┐ │  │ ┌──────────────────────┐ │
│ │ André Meireles       │ │  │ │ João Silva           │ │
│ │ Closer: Thayna       │ │  │ │ Closer: Julio        │ │
│ │ 25/03 · A010         │ │  │ │ 24/03 · LIVE         │ │
│ │ 📱 21981541133       │ │  │ │ ✅ Enviado 24/03     │ │
│ └──────────────────────┘ │  │ └──────────────────────┘ │
│  (scroll vertical)       │  │                          │
└──────────────────────────┘  └──────────────────────────┘
```

### Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `package.json` | Adicionar `@hello-pangea/dnd` |
| `src/components/relatorios/ControleDiegoPanel.tsx` | Substituir `<Table>` por `<DragDropContext>` + 2 `<Droppable>` columns com `<Draggable>` cards. Manter filtros e KPIs. Ao dropar card entre colunas, chamar `toggleMutation`. |
| `src/hooks/useVideoControl.ts` | Adicionar insert em `deal_activities` (type `video_sent`) na mutation quando `videoSent=true`. Precisa receber `dealId` opcional. |
| `src/hooks/useContractReport.ts` | Expor `dealId` no `ContractReportRow` (já disponível via `row.deal_id`). |

### Comportamento do drag & drop
- Arrastar card de "Pendentes" → "Enviados": marca `video_sent = true`, registra atividade no deal
- Arrastar card de "Enviados" → "Pendentes": marca `video_sent = false`
- Click no card: abre drawer (mantém comportamento atual)
- Click no telefone: abre WhatsApp (mantém)
- Cada coluna com scroll vertical independente

