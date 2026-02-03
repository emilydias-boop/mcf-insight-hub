
# Plano: Adicionar Filtro de Origem na Página Consórcio

## Objetivo

Adicionar um filtro de "Origem" na barra de filtros da página de Consórcio, permitindo filtrar por valores como: Reverter, Outros, Sócios, GR, Indicação, Clube do Arremate, etc.

## Análise Atual

A página já possui:
- Hook `useConsorcioOrigemOptions()` que busca origens da tabela `consorcio_origem_options`
- Carrega `origemOptions` no componente (linha 152)
- Coluna "Origem" na tabela que mostra o valor

**Valores existentes no banco:**
- `clube_arremate` (Clube do Arremate)
- `outros` (Outros)
- `reverter` (Reverter)
- `socio` (Sócio)

## Alterações Necessárias

### 1. Adicionar estado do filtro no componente

**Arquivo:** `src/pages/bu-consorcio/Index.tsx`

Adicionar novo state:
```typescript
const [origemFilter, setOrigemFilter] = useState<string>('todos');
```

### 2. Incluir filtro no objeto `filters`

Adicionar ao objeto filters (linha ~171-180):
```typescript
origem: origemFilter !== 'todos' ? origemFilter : undefined,
```

### 3. Adicionar Select de Origem na UI

Adicionar logo após o Select de "Grupo" (antes do ConsorcioPeriodFilter):
```typescript
<Select value={origemFilter} onValueChange={setOrigemFilter}>
  <SelectTrigger className="w-32">
    <SelectValue placeholder="Origem" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="todos">Origem</SelectItem>
    {origemOptions.map(opt => (
      <SelectItem key={opt.id} value={opt.name}>{opt.label}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

### 4. Atualizar o hook useConsorcioCards

**Arquivo:** `src/hooks/useConsorcio.ts`

Adicionar `origem` na interface `ConsorcioFilters`:
```typescript
interface ConsorcioFilters {
  // ... campos existentes
  origem?: string;
}
```

Adicionar filtro na query:
```typescript
if (filters.origem) {
  query = query.eq('origem', filters.origem);
}
```

### 5. Resetar página ao mudar filtro

Adicionar `origemFilter` no useEffect de reset (linha 229-231):
```typescript
useEffect(() => {
  setCurrentPage(1);
}, [statusFilter, tipoFilter, vendedorFilter, period, itemsPerPage, searchTerm, vencimentoFilter, grupoFilter, origemFilter, dateRangeFilter]);
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/bu-consorcio/Index.tsx` | Adicionar state, UI do Select e incluir no filters |
| `src/hooks/useConsorcio.ts` | Adicionar campo `origem` na interface e na query |

## Resultado Esperado

```
┌────────────────────────────────────────────────────────────────────────────┐
│  [Q Busca...] [Status ▼] [Tipo ▼] [Vendedor ▼] [Vencimento ▼] [Grupo ▼]   │
│                                                                             │
│  [Origem ▼]  [Período]                                     [Exportar CSV]  │
│    ┌─────────────────┐                                                      │
│    │ Todas Origens   │                                                      │
│    │ Sócio           │                                                      │
│    │ GR              │                                                      │
│    │ Indicação       │                                                      │
│    │ Clube Arremate  │                                                      │
│    │ Reverter        │                                                      │
│    │ Outros          │                                                      │
│    └─────────────────┘                                                      │
└────────────────────────────────────────────────────────────────────────────┘
```
