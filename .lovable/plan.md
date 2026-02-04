
# Plano: Mover Modo Seleção para Cada Estágio

## Visão Geral

Descentralizar o modo de seleção: em vez de um botão global "Modo Seleção" no topo, cada estágio terá seus próprios controles de seleção no header da coluna.

---

## Mudanças na Interface

### Antes (Global)
```text
┌─────────────────────────────────────────────────────────────────────┐
│ [Buscar...]  [Status▼]  [Responsável▼]        [✓ Modo Seleção]     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Novo Lead 75│  │ Qualificado │  │ Agendado 40 │
├─────────────┤  ├─────────────┤  ├─────────────┤
│ □ Lead 1    │  │ □ Lead 1    │  │ □ Lead 1    │
│ □ Lead 2    │  │ □ Lead 2    │  │ □ Lead 2    │
└─────────────┘  └─────────────┘  └─────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  # Selecionar quantidade: [___] [Aplicar] [Todos]          [X]      │
└─────────────────────────────────────────────────────────────────────┘
```

### Depois (Por Estágio)
```text
┌─────────────────────────────────────────────────────────────────────┐
│ [Buscar...]  [Status▼]  [Responsável▼]                              │
└─────────────────────────────────────────────────────────────────────┘

┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
│ Novo Lead      75 │  │ Qualificado   50  │  │ Agendado      40  │
│ [☐] [50▼] [✓Todos]│  │ [☐] [50▼] [✓Todos]│  │ [☐] [50▼] [✓Todos]│
├───────────────────┤  ├───────────────────┤  ├───────────────────┤
│ ✓ Lead 1          │  │ □ Lead 1          │  │ □ Lead 1          │
│ ✓ Lead 2          │  │ □ Lead 2          │  │ □ Lead 2          │
│ ...               │  │ ...               │  │ ...               │
│ ✓ Lead 50         │  │ □ Lead 50         │  │ □ Lead 40         │
│ □ Lead 51         │  │                   │  │                   │
└───────────────────┘  └───────────────────┘  └───────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  ✓ 50 leads selecionados  │ [Transferir para...] [X]                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/crm/DealFilters.tsx` | Remover botão "Modo Seleção" |
| `src/components/crm/DealKanbanBoard.tsx` | Adicionar controles de seleção no header de cada estágio |
| `src/components/crm/BulkActionsBar.tsx` | Simplificar - remover selector de quantidade (fica no stage) |
| `src/pages/crm/Negocios.tsx` | Remover estado `selectionMode` global, adaptar handlers |

---

## Detalhes da Implementação

### 1. DealKanbanBoard.tsx - Novo Header do Estágio

Cada coluna terá:
- **Input numérico**: Selecionar os primeiros N leads do estágio
- **Botão "Todos"**: Selecionar todos os leads do estágio
- **Checkbox visual**: Mostra estado (nenhum/parcial/todos)

```tsx
<CardHeader className={`flex-shrink-0 py-3 ${stage.color || 'bg-muted'}`}>
  <CardTitle className="text-sm font-medium">
    <div className="flex items-center justify-between">
      <span>{stage.stage_name}</span>
      <Badge variant="secondary">{stageDeals.length}</Badge>
    </div>
    {/* Nova barra de seleção por estágio */}
    {stageDeals.length > 0 && (
      <div className="flex items-center gap-1 mt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleSelectAllInStage(stageDeals)}
          className="h-6 w-6 p-0"
        >
          {/* Ícone de checkbox baseado no estado */}
        </Button>
        <Input
          type="number"
          placeholder="Qtd"
          className="w-14 h-6 text-xs"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSelectByCountInStage(stage.id, count);
          }}
        />
        <Button size="sm" variant="ghost" className="h-6 text-xs">
          Todos
        </Button>
      </div>
    )}
  </CardTitle>
</CardHeader>
```

### 2. Novo Componente: StageSelectionControls

Criar um componente dedicado para os controles de seleção de cada estágio:

```tsx
interface StageSelectionControlsProps {
  stageId: string;
  stageDeals: Deal[];
  selectedDealIds: Set<string>;
  onSelectByCount: (stageId: string, count: number) => void;
  onSelectAll: (stageId: string) => void;
  onClearStage: (stageId: string) => void;
}

const StageSelectionControls = ({...}: StageSelectionControlsProps) => {
  const [count, setCount] = useState('');
  
  // Retorna controles compactos para o header
  return (
    <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-border/30">
      {/* Checkbox de estado */}
      {/* Input de quantidade */}
      {/* Botão "Todos" */}
    </div>
  );
};
```

### 3. DealFilters.tsx

Remover:
- Prop `selectionMode`
- Prop `onToggleSelectionMode`
- Botão "Modo Seleção"

### 4. BulkActionsBar.tsx

Simplificar para mostrar apenas quando há seleção:
- Remover estado de quantidade input global
- Manter apenas: contador de selecionados + botão Transferir + botão X

### 5. Negocios.tsx

- Remover estado `selectionMode` global
- Adaptar `handleSelectByCount` para receber `stageId`
- Nova função `handleSelectByCountInStage(stageId: string, count: number)`
- O modo de seleção será "automático" - ativa quando qualquer deal é selecionado

---

## Fluxo de Uso Atualizado

1. Usuário vê os controles de seleção em cada estágio
2. Digita "30" no input de um estágio específico e pressiona Enter
3. Os primeiros 30 leads daquele estágio são selecionados (de cima para baixo)
4. BulkActionsBar aparece com "30 leads selecionados"
5. Pode repetir em outros estágios para acumular seleção
6. Clica "Transferir para..." para ação em massa

---

## Resumo Técnico

- **Remoção**: Botão global "Modo Seleção" do DealFilters
- **Adição**: Controles inline no header de cada estágio do Kanban
- **Comportamento**: Seleção sempre disponível, BulkActionsBar aparece automaticamente quando há seleção
- **UX**: Mais intuitivo - controles visíveis no contexto de cada estágio
