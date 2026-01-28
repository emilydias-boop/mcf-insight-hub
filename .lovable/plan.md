
# Filtro por Quantidade de Tentativas (Range)

## Objetivo
Adicionar um filtro com inputs numéricos para definir intervalo de tentativas de contato:
- **Mínimo**: Quantidade mínima de tentativas (ex: 0)
- **Máximo**: Quantidade máxima de tentativas (ex: 1)

Exemplo: `0 a 1` mostraria leads com 0 ou 1 tentativa (menos trabalhados como Márcia, Jean, Cristina)

---

## Visual do Componente

```text
+------------------------------------------+
| 📞 Tentativas                            |
| +------+ a +------+  [Aplicar]           |
| |  0   |   |  2   |                      |
| +------+   +------+                      |
+------------------------------------------+
```

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/crm/DealFilters.tsx` | Adicionar campos min/max de tentativas com Popover |
| `src/pages/crm/Negocios.tsx` | Aplicar filtro no `filteredDeals` usando activitySummaries |

---

## Detalhes Técnicos

### 1. Atualizar `DealFiltersState` em DealFilters.tsx

```typescript
export interface DealFiltersState {
  search: string;
  dateRange: DateRange | undefined;
  owner: string | null;
  dealStatus: 'all' | 'open' | 'won' | 'lost';
  inactivityDays: number | null;
  salesChannel: SalesChannelFilter;
  // NOVO: Filtro por range de tentativas
  attemptsRange: { min: number; max: number } | null;
}
```

### 2. Componente de Filtro (Popover com inputs)

Adicionar um Popover com dois inputs numéricos e botão Aplicar:

```tsx
{/* Filtro de Tentativas (Range) */}
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline" className="justify-start text-left font-normal">
      <Phone className="mr-2 h-4 w-4" />
      {filters.attemptsRange 
        ? `${filters.attemptsRange.min} a ${filters.attemptsRange.max} tent.`
        : "Tentativas"
      }
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-64">
    <div className="space-y-3">
      <Label className="text-sm font-medium">Quantidade de tentativas</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          placeholder="Mín"
          value={localMinAttempts}
          onChange={(e) => setLocalMinAttempts(e.target.value)}
          className="w-20"
        />
        <span className="text-muted-foreground">a</span>
        <Input
          type="number"
          min={0}
          placeholder="Máx"
          value={localMaxAttempts}
          onChange={(e) => setLocalMaxAttempts(e.target.value)}
          className="w-20"
        />
      </div>
      <Button size="sm" onClick={handleApplyAttemptsFilter}>
        Aplicar
      </Button>
    </div>
  </PopoverContent>
</Popover>
```

### 3. Lógica de Aplicação (Negocios.tsx)

No `filteredDeals`, adicionar verificação do range:

```typescript
// Filtro por quantidade de tentativas (range)
if (filters.attemptsRange) {
  const summary = activitySummaries?.get(deal.id);
  const totalCalls = summary?.totalCalls || 0;
  
  if (totalCalls < filters.attemptsRange.min || 
      totalCalls > filters.attemptsRange.max) {
    return false;
  }
}
```

### 4. Atualizar Estado Inicial e clearFilters

```typescript
// Estado inicial
const [filters, setFilters] = useState<DealFiltersState>({
  ...
  attemptsRange: null,
});

// Limpar filtros
const clearFilters = () => {
  setFilters({
    ...
    attemptsRange: null,
  });
};
```

---

## Exemplos de Uso

| Filtro | Resultado |
|--------|-----------|
| `0 a 0` | Leads sem nenhuma tentativa |
| `0 a 1` | Leads com 0 ou 1 tentativa (menos trabalhados) |
| `4 a 5` | Leads com 4 ou 5 tentativas (mais trabalhados, como Tabatha) |
| `3 a 10` | Leads com 3+ tentativas |

---

## Comportamento

1. Clicar no botão "Tentativas" abre um popover
2. Usuário digita min (ex: 0) e max (ex: 1)
3. Clicar em "Aplicar" fecha o popover e filtra
4. O botão mostra o filtro ativo: "0 a 1 tent."
5. "Limpar" remove o filtro junto com os outros
