
# Plano: Adicionar Filtros, Busca e Coluna Canal no Relatório de Vendas

## Objetivo

Aplicar no relatório de **Vendas** as mesmas melhorias feitas no relatório de **Contratos**:
1. Campo de busca por nome, email ou telefone
2. Filtro por Canal de Vendas (A010, BIO, LIVE)
3. Coluna "Canal" na tabela mostrando a classificação
4. KPIs dinâmicas que acompanham os filtros aplicados

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/relatorios/SalesReportPanel.tsx` | Adicionar filtros, busca, coluna Canal e KPIs dinâmicas |

---

## Alterações Detalhadas

### 1. Novos Estados

```typescript
const [searchTerm, setSearchTerm] = useState<string>('');
const [selectedChannel, setSelectedChannel] = useState<string>('all');
```

### 2. Detectar Canal de Vendas

Criar lógica para classificar cada transação:

```typescript
const detectSalesChannel = (productName: string | null): 'A010' | 'BIO' | 'LIVE' => {
  const name = (productName || '').toLowerCase();
  
  // A010 - produto do curso A010
  if (name.includes('a010')) {
    return 'A010';
  }
  
  // BIO - produtos relacionados (pode ser expandido)
  if (name.includes('bio') || name.includes('instagram')) {
    return 'BIO';
  }
  
  // LIVE - padrão (vendas ao vivo)
  return 'LIVE';
};
```

### 3. Dados Filtrados com Memoização

```typescript
const filteredTransactions = useMemo(() => {
  let filtered = [...transactions];
  
  // Filtro por canal
  if (selectedChannel !== 'all') {
    filtered = filtered.filter(t => {
      const channel = detectSalesChannel(t.product_name);
      return channel === selectedChannel.toUpperCase();
    });
  }
  
  // Filtro por busca textual
  if (searchTerm.trim()) {
    const term = searchTerm.toLowerCase().trim();
    const termDigits = searchTerm.replace(/\D/g, '');
    
    filtered = filtered.filter(t => {
      const nameMatch = (t.customer_name || '').toLowerCase().includes(term);
      const emailMatch = (t.customer_email || '').toLowerCase().includes(term);
      const phoneMatch = termDigits.length >= 4 && 
        (t.customer_phone || '').replace(/\D/g, '').includes(termDigits);
      
      return nameMatch || emailMatch || phoneMatch;
    });
  }
  
  return filtered;
}, [transactions, selectedChannel, searchTerm]);
```

### 4. KPIs Dinâmicas

Recalcular stats a partir dos dados **filtrados**:

```typescript
const stats = useMemo(() => {
  const totalGross = filteredTransactions.reduce(
    (sum, t) => sum + (t.gross_override || t.product_price || 0), 0
  );
  const totalNet = filteredTransactions.reduce(
    (sum, t) => sum + (t.net_value || 0), 0
  );
  const count = filteredTransactions.length;
  const avgTicket = count > 0 ? totalNet / count : 0;
  
  return { totalGross, totalNet, count, avgTicket };
}, [filteredTransactions]);
```

### 5. UI - Área de Filtros

Layout inspirado no ContractReportPanel:

```text
┌────────────────────────────────────────────────────────────────────────────────────┐
│  Período           │  Buscar              │  Canal           │  [Exportar Excel]  │
│  [01/01 - 31/01]   │  [🔍 Nome, email...] │  [Todos ▼]       │                    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

**Componentes:**
- DatePickerCustom (existente)
- Input com ícone Search (novo)
- Select para Canal: Todos, A010, BIO, LIVE (novo)
- Button Exportar Excel (existente)

### 6. Coluna "Canal" na Tabela

Adicionar nova coluna entre "Email" e "Valor Bruto":

```tsx
<TableHead>Canal</TableHead>

// Na row:
<TableCell>
  <Badge variant={channel === 'A010' ? 'default' : channel === 'BIO' ? 'secondary' : 'outline'}>
    {channel}
  </Badge>
</TableCell>
```

### 7. Exportação Excel Atualizada

Adicionar coluna "Canal" na exportação e usar dados filtrados:

```typescript
const handleExportExcel = () => {
  const exportData = filteredTransactions.map(row => ({
    'Data': row.sale_date ? format(parseISO(row.sale_date), 'dd/MM/yyyy', { locale: ptBR }) : '',
    'Produto': row.product_name || '',
    'Canal': detectSalesChannel(row.product_name), // NOVO
    'Categoria': row.product_category || '',
    'Cliente': row.customer_name || '',
    'Email': row.customer_email || '',
    'Telefone': row.customer_phone || '',
    'Valor Bruto': row.gross_override || row.product_price || 0,
    'Valor Líquido': row.net_value || 0,
    'Parcela': row.installment_number ? `${row.installment_number}/${row.total_installments}` : '-',
    'Status': row.sale_status || '',
    'Fonte': row.source || '',
  }));
  // ...
};
```

---

## Imports Adicionais

```typescript
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
```

---

## Comportamento Esperado

| Ação | Resultado |
|------|-----------|
| Digitar "João" na busca | Filtra por clientes com "João" no nome |
| Digitar "email@teste.com" | Filtra por esse email |
| Selecionar "A010" no Canal | Mostra apenas transações de produtos A010 |
| Combinar filtros | Busca + Canal funcionam juntos |
| KPIs | Atualizam instantaneamente |
| Exportar Excel | Exporta dados filtrados com coluna Canal |

---

## Layout Visual da Tabela

```text
┌─────────┬──────────────────────────┬─────────┬───────────────────┬─────────────┬──────────────┬─────────┬───────────┐
│  Data   │  Produto                 │  Canal  │  Cliente          │  Email      │  Valor Bruto │  V. Líq │  Status   │
├─────────┼──────────────────────────┼─────────┼───────────────────┼─────────────┼──────────────┼─────────┼───────────┤
│ 29/01   │ A010 - Consultoria...    │  A010   │  Alex Silva       │  alex@...   │  R$ 47,00    │  R$ 35  │ completed │
│ 29/01   │ A000 - Contrato          │  LIVE   │  Diego Jerônimo   │  diego@...  │  R$ 497,00   │  R$ 388 │ completed │
└─────────┴──────────────────────────┴─────────┴───────────────────┴─────────────┴──────────────┴─────────┴───────────┘
```

---

## Resumo das Mudanças

| Componente | Mudança |
|------------|---------|
| Estados | `searchTerm`, `selectedChannel` |
| Função | `detectSalesChannel()` |
| useMemo | `filteredTransactions` para aplicar filtros |
| useMemo | `stats` recalculado com dados filtrados |
| UI Filtros | Input busca + Select canal |
| Tabela | Nova coluna "Canal" com Badge |
| Excel | Coluna "Canal" + dados filtrados |
| Imports | `Search`, `Input`, `Select` components |
