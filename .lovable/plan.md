

# Adicionar Exibição de Leads vs Meta na Agenda R2 (Por Sócio)

## Objetivo

Replicar no calendário R2 ("Por Sócio") a mesma exibição que já existe no R1 - mostrar a quantidade de leads que cada closer possui no dia comparado à meta diária.

## Situação Atual

| Componente | Exibe leads vs meta? | Local |
|------------|---------------------|-------|
| R1 - CloserColumnCalendar.tsx | ✅ Sim (ex: "5 / 18 leads") | Abaixo do nome do closer |
| **R2 - R2CloserColumnCalendar.tsx** | ❌ **NÃO** | Apenas nome do closer |

## Implementação

### Arquivo: `src/components/crm/R2CloserColumnCalendar.tsx`

#### 1. Adicionar constante de meta (após linha 43)

```typescript
// Meta de leads por closer por dia (R2)
const R2_CLOSER_META = 18;
```

#### 2. Adicionar cálculo de leads por closer (dentro do componente, antes do return)

```typescript
// Contador de leads (attendees) agendados por closer no dia
const dailyLeadCounts = useMemo(() => {
  const counts: Record<string, number> = {};
  
  meetings.forEach((meeting) => {
    const closerId = meeting.closer?.id;
    if (!closerId) return;
    
    // Verificar se a reunião é no dia selecionado
    if (!isSameDay(parseISO(meeting.scheduled_at), selectedDate)) return;
    
    const attendeesCount = meeting.attendees?.length || 0;
    counts[closerId] = (counts[closerId] || 0) + attendeesCount;
  });
  
  return counts;
}, [meetings, selectedDate]);
```

#### 3. Modificar header dos closers (linhas 174-180)

**De:**
```tsx
{closers.map((closer) => (
  <div key={closer.id} className="p-2 text-center border-l">
    <div className="flex items-center justify-center gap-2">
      <span className="font-medium text-sm">{closer.name}</span>
    </div>
  </div>
))}
```

**Para:**
```tsx
{closers.map((closer) => {
  const leadCount = dailyLeadCounts[closer.id] || 0;
  return (
    <div key={closer.id} className="p-2 text-center border-l">
      <div className="flex items-center justify-center gap-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: closer.color || '#9333EA' }} />
        <span className="font-medium text-sm">{closer.name}</span>
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">
        <span className={cn("font-medium", leadCount >= R2_CLOSER_META ? "text-green-500" : "text-yellow-500")}>
          {leadCount}
        </span>
        <span> / {R2_CLOSER_META} leads</span>
      </div>
    </div>
  );
})}
```

## Resultado Visual Esperado

```text
┌──────────────────────────────────────────────────────────────────────┐
│ qua 28/01  │   Cristiane Gomes   │      Julio       │     Thayna     │
│            │    ● 11 / 18 leads  │   ● 14 / 18 leads│  ● 11 / 18 leads│
├──────────────────────────────────────────────────────────────────────┤
│   09:00    │                     │                   │                │
│   10:00    │   Carlos Henrique   │                   │                │
│   ...      │                     │                   │                │
└──────────────────────────────────────────────────────────────────────┘
```

## Lógica de Cores

- **Verde** (`text-green-500`): Quando `leadCount >= 18` (meta batida)
- **Amarelo** (`text-yellow-500`): Quando `leadCount < 18` (meta não batida)

## Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `src/components/crm/R2CloserColumnCalendar.tsx` | Adicionar constante R2_CLOSER_META, useMemo para dailyLeadCounts, e exibição abaixo do nome |

## Resumo Técnico

- **Constante**: `R2_CLOSER_META = 18`
- **Hook**: `useMemo` para contar attendees por closer no dia
- **UI**: Exibir `{count} / 18 leads` com cor condicional
- **Risco**: Baixo (apenas adiciona elementos visuais, não altera dados)

