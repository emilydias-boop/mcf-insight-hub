
# Plano: Adicionar Filtro de Closer R1 na Agenda R2

## Objetivo

Adicionar um filtro na Agenda R2 que permita filtrar as reunioes pelo closer que conduziu a R1, facilitando o acompanhamento do funil de vendas.

---

## Como Vai Funcionar

1. Novo dropdown "Closer R1" ao lado dos filtros existentes
2. Selecionar um closer R1 mostra apenas leads que passaram pela R1 daquele closer
3. Funciona em conjunto com os filtros existentes (Closer R2, Status)

---

## Alteracoes

### Arquivo: `src/pages/crm/AgendaR2.tsx`

**1. Adicionar estado do filtro (linha ~76)**
```typescript
const [r1CloserFilter, setR1CloserFilter] = useState<string>("all");
```

**2. Importar hook de closers R1**
```typescript
import { useGestorClosers } from "@/hooks/useGestorClosers";
```

**3. Buscar lista de closers R1 (apos linha ~126)**
```typescript
const { data: r1Closers = [] } = useGestorClosers('r1');
```

**4. Adicionar filtro na logica de filteredMeetings (linha ~143)**
```typescript
// Filtro por closer R1
if (r1CloserFilter !== "all") {
  filtered = filtered.filter((m) => m.r1_closer?.id === r1CloserFilter);
}
```

**5. Adicionar dropdown na UI (apos linha ~488)**
```typescript
{/* R1 Closer Filter */}
{!isR2Closer && (
  <Select value={r1CloserFilter} onValueChange={setR1CloserFilter}>
    <SelectTrigger className="w-[180px]">
      <SelectValue placeholder="Closer R1" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">Todos Closers R1</SelectItem>
      {r1Closers.map((closer) => (
        <SelectItem key={closer.id} value={closer.id}>
          {closer.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
)}
```

---

## Fluxo de Filtragem

```text
Reunioes R2
    |
    v
Filtro Closer R2 (existente)
    |
    v
Filtro Status (existente)
    |
    v
Filtro Closer R1 (NOVO)  <-- Filtra por quem fez a R1
    |
    v
Lista filtrada
```

---

## Resultado Visual

Na barra de filtros, ao lado do dropdown "Closer" (R2) e "Status", aparecera um novo dropdown "Closer R1" com a lista de closers que fazem R1 (Julio, Thayna, Cristiane, Mateus Macedo, etc.)

---

## Secao Tecnica

### Dados Disponiveis
O hook `useR2MeetingsExtended` ja retorna `r1_closer` em cada meeting:
```typescript
r1_closer: { id: string; name: string; scheduled_at: string | null }
```

### Hook Utilizado
`useGestorClosers('r1')` - ja existe e retorna closers filtrados por meeting_type='r1'

### Dependencias entre Filtros
Os 3 filtros funcionam em cascata (AND logico):
- Closer R2 AND Status AND Closer R1 = Resultado final
