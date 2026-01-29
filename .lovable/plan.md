
# Plano: Adicionar Filtro de Busca e KPIs Dinâmicas no Relatório de Contratos

## Objetivo

Adicionar um campo de busca por **nome, email ou telefone** no relatório de Contratos, e fazer com que as **KPIs (cards de métricas)** se atualizem automaticamente de acordo com os resultados filtrados.

---

## Análise do Estado Atual

O `ContractReportPanel.tsx` já possui vários filtros:
- Período (DatePicker)
- Fonte (Ambos, Agenda, Hubla A000, Pendentes)
- Closer
- Pipeline
- Canal

Porém **não possui** um campo de busca textual.

As KPIs atualmente são calculadas a partir dos dados completos (`agendaData`, `hublaData`, `hublaPending`), sem considerar o filtro da tabela.

---

## Alterações Necessárias

### Arquivo: `src/components/relatorios/ContractReportPanel.tsx`

| Mudança | Descrição |
|---------|-----------|
| Novo estado `searchTerm` | Para armazenar o texto de busca |
| Novo Input de busca | Campo com ícone de lupa na área de filtros |
| Filtro no `unifiedData` | Adicionar lógica para filtrar por nome, email ou telefone |
| KPIs recalculadas | Usar os dados filtrados para calcular as métricas |

---

## Implementação Detalhada

### 1. Adicionar Estado de Busca

```typescript
const [searchTerm, setSearchTerm] = useState('');
```

### 2. Adicionar Input de Busca na UI

Inserir entre o seletor de "Período" e "Fonte":

```tsx
<div className="w-[250px]">
  <label className="text-sm font-medium text-muted-foreground mb-2 block">Buscar</label>
  <div className="relative">
    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    <Input
      placeholder="Nome, email ou telefone..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="pl-9"
    />
  </div>
</div>
```

### 3. Aplicar Filtro de Busca no `unifiedData`

Modificar o `useMemo` que cria `unifiedData` para incluir filtro por `searchTerm`:

```typescript
const unifiedData = useMemo((): UnifiedContractRow[] => {
  const rows: UnifiedContractRow[] = [];
  
  // ... lógica existente para popular rows ...
  
  // Filtro por canal (existente)
  let filtered = rows.filter(row => 
    selectedChannel === 'all' || row.salesChannel === selectedChannel.toUpperCase() || row.source !== 'agenda'
  );
  
  // NOVO: Filtro por busca textual
  if (searchTerm.trim()) {
    const term = searchTerm.toLowerCase().trim();
    const termDigits = searchTerm.replace(/\D/g, ''); // Para busca por telefone
    
    filtered = filtered.filter(row => {
      const nameMatch = row.leadName.toLowerCase().includes(term);
      const emailMatch = row.leadEmail.toLowerCase().includes(term);
      const phoneMatch = termDigits.length >= 4 && row.leadPhone.replace(/\D/g, '').includes(termDigits);
      
      return nameMatch || emailMatch || phoneMatch;
    });
  }
  
  // Ordenar por data DESC
  return filtered.sort((a, b) => b.date.localeCompare(a.date));
}, [agendaData, hublaData, hublaPending, selectedSource, selectedChannel, searchTerm]);
```

### 4. Recalcular KPIs com Base nos Dados Filtrados

Modificar o `useMemo` de `stats` para usar `unifiedData` filtrado em vez dos dados brutos:

```typescript
const stats = useMemo(() => {
  // Contagens baseadas nos dados FILTRADOS
  const agendaTotal = unifiedData.filter(r => r.source === 'agenda').length;
  const hublaTotal = unifiedData.filter(r => r.source === 'hubla' || r.source === 'pending').length;
  const pendingTotal = unifiedData.filter(r => r.source === 'pending').length;
  const uniqueClosers = new Set(
    unifiedData
      .filter(r => r.source === 'agenda')
      .map(r => r.closerEmail)
  ).size;
  
  return { agendaTotal, hublaTotal, pendingTotal, uniqueClosers };
}, [unifiedData]);
```

### 5. Adicionar Import do Ícone e Input

No topo do arquivo:

```typescript
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
```

---

## Layout Visual do Filtro

A nova linha de filtros ficará assim:

```text
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  Período           │  Buscar              │  Fonte  │  Closer  │  Pipeline  │  Canal │
│  [01/01 - 31/01]   │  [🔍 Nome, email...] │  [Ambos]│  [Todos] │  [Todas]   │ [Todos]│
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Comportamento Esperado

| Ação | Resultado |
|------|-----------|
| Digitar "Julio" | Filtra leads com "Julio" no nome |
| Digitar "email@teste.com" | Filtra leads com esse email |
| Digitar "999947809" | Filtra leads com esse telefone |
| Limpar busca | Volta a mostrar todos os registros |
| KPIs | Atualizam instantaneamente conforme filtro |

---

## Exemplo de Interação

1. Usuário digita "Willian" no campo de busca
2. Tabela mostra apenas registros onde o nome do lead contém "Willian"
3. KPIs se atualizam:
   - Agenda (Atribuídos): 1 (apenas os da agenda que casam)
   - Hubla A000: 0 (ou N, se houver match na Hubla)
   - Pendentes: 0
   - Closers Ativos: 1 (único closer dos resultados)

---

## Resumo das Mudanças

| Linha | Tipo | Descrição |
|-------|------|-----------|
| ~8 | Import | Adicionar `Search` do lucide-react |
| ~9 | Import | Adicionar `Input` dos componentes UI |
| ~57 | State | Adicionar `const [searchTerm, setSearchTerm] = useState('')` |
| ~296-306 | UI | Inserir campo de busca na área de filtros |
| ~242-248 | Lógica | Adicionar filtro por `searchTerm` no `unifiedData` |
| ~251-258 | Lógica | Recalcular `stats` a partir do `unifiedData` filtrado |

---

## Impacto

- **UX**: Usuários podem localizar rapidamente um contrato específico
- **KPIs**: Refletem os dados visíveis na tabela
- **Excel**: Exportação considera o filtro aplicado (comportamento existente)
- **Performance**: Filtro é client-side no `useMemo`, sem novas requisições ao banco
