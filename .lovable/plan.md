
# Plano: Corrigir Filtro de Responsáveis e Adicionar Seleção por Stage

## Problema 1: Jessica Bellini não aparece no filtro

### Diagnóstico
- Jessica Bellini tem role **admin** (não SDR/Closer)
- O filtro de responsáveis (`DealFilters.tsx`) busca APENAS usuários com roles `sdr` ou `closer`
- Ela tem **86 deals** atribuídos a ela que não podem ser filtrados

### Solução
Expandir a query para incluir **todos os roles que podem ter deals atribuídos**:
- `sdr`
- `closer`
- `admin`
- `manager`
- `coordenador`

| Query Atual | Query Nova |
|-------------|------------|
| `.in('user_roles.role', ['sdr', 'closer'])` | `.in('user_roles.role', ['sdr', 'closer', 'admin', 'manager', 'coordenador'])` |

Também preciso atualizar a mesma query no `BulkTransferDialog.tsx` para que a transferência em massa possa atribuir para qualquer usuário operacional.

---

## Problema 2: Sem opção de selecionar todos de uma stage

### Diagnóstico
- O modo de seleção atual permite apenas clicar em cards individuais
- Não há botão para selecionar/desselecionar todos os cards de uma coluna (stage)
- Isso dificulta transferências em massa quando há muitos leads em uma stage

### Solução
Adicionar um **botão "Selecionar todos"** no header de cada coluna do Kanban quando o modo de seleção estiver ativo:

| Estado | Comportamento |
|--------|---------------|
| Nenhum selecionado | Botão "☐" exibe count → seleciona todos visíveis |
| Alguns selecionados | Botão "◐" exibe count → seleciona todos visíveis |
| Todos selecionados | Botão "☑" exibe count → desseleciona todos |

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/crm/DealFilters.tsx` | Expandir roles na query de responsáveis |
| `src/components/crm/BulkTransferDialog.tsx` | Expandir roles para destino de transferência |
| `src/components/crm/DealKanbanBoard.tsx` | Adicionar botão "Selecionar todos" por stage |

---

## Detalhes Técnicos

### 1. Atualizar Query de Responsáveis (DealFilters.tsx)

**Linha 64 - Antes:**
```typescript
.in('user_roles.role', ['sdr', 'closer'])
```

**Depois:**
```typescript
.in('user_roles.role', ['sdr', 'closer', 'admin', 'manager', 'coordenador'])
```

### 2. Atualizar Query de Transferência (BulkTransferDialog.tsx)

**Linha 37 - Antes:**
```typescript
.in('user_roles.role', ['sdr', 'closer'])
```

**Depois:**
```typescript
.in('user_roles.role', ['sdr', 'closer', 'admin', 'manager', 'coordenador'])
```

### 3. Adicionar Seleção por Stage (DealKanbanBoard.tsx)

Adicionar no header de cada coluna (quando `selectionMode === true`):

```typescript
// No CardHeader, ao lado do Badge de contagem
{selectionMode && (
  <Button
    variant="ghost"
    size="sm"
    onClick={() => handleSelectAllInStage(stage.id, stageDeals)}
    className="h-6 w-6 p-0"
  >
    {/* Ícone de checkbox baseado no estado */}
    {allSelected ? <CheckSquare /> : someSelected ? <MinusSquare /> : <Square />}
  </Button>
)}
```

**Nova função:**
```typescript
const handleSelectAllInStage = (stageId: string, stageDeals: Deal[]) => {
  const stageDealIds = stageDeals.map(d => d.id);
  const allSelected = stageDealIds.every(id => selectedDealIds.has(id));
  
  stageDealIds.forEach(id => {
    onSelectionChange?.(id, !allSelected);
  });
};
```

---

## Props Necessárias

O `DealKanbanBoard` precisa receber mais uma prop do `Negocios.tsx`:

```typescript
interface DealKanbanBoardProps {
  // ... props existentes
  onSelectAllInStage?: (dealIds: string[], selected: boolean) => void;
}
```

E em `Negocios.tsx`, adicionar handler:

```typescript
const handleSelectAllInStage = (dealIds: string[], selected: boolean) => {
  setSelectedDealIds(prev => {
    const newSet = new Set(prev);
    dealIds.forEach(id => {
      if (selected) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
    });
    return newSet;
  });
};
```

---

## Resultado Esperado

1. Jessica Bellini e outros admins/managers aparecem no dropdown de responsáveis
2. Transferência em massa pode atribuir para admins/managers também
3. Em modo de seleção, cada coluna tem um checkbox no header para selecionar/desselecionar todos os cards visíveis daquela stage
4. O checkbox indica visualmente se todos, alguns ou nenhum estão selecionados
