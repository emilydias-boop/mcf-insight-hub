

# Unificar Logica de Atribuicao entre Vendas e Aquisicao

## Problema

Os numeros de "Faturamento por Closer" na aba **Vendas** e na aba **Aquisicao & Origem** sao diferentes porque cada uma usa sua propria logica de atribuicao, com diferencas em:

1. **Closers carregados**: Vendas usa `useGestorClosers('r1')` (todos os closers R1, sem filtro de BU), enquanto Aquisicao filtra por `closers.bu = 'incorporador'`
2. **Logica de matching duplicada**: Cada componente reimplementa o matching email/telefone de forma independente
3. **Eventos newsale**: Podem inflar numeros em um painel e nao no outro

## Solucao

Refatorar o `SalesReportPanel` para reutilizar o mesmo hook `useAcquisitionReport` como fonte unica de dados classificados, garantindo que ambas as abas produzam numeros identicos para os mesmos closers.

## Detalhes tecnicos

### Etapa 1: Corrigir busca de closers no SalesReportPanel

Substituir `useGestorClosers('r1')` por uma query filtrada por BU, identica a do `useAcquisitionReport`:

```typescript
// DE (SalesReportPanel.tsx linha 89):
const { data: closers = [] } = useGestorClosers('r1');

// PARA:
const { data: closers = [] } = useQuery({
  queryKey: ['acquisition-closers', bu],
  queryFn: async () => {
    let query = supabase
      .from('closers')
      .select('id, name, email, color, bu')
      .eq('is_active', true)
      .or('meeting_type.is.null,meeting_type.eq.r1');
    if (bu) query = query.eq('bu', bu);
    const { data, error } = await query.order('name');
    if (error) throw error;
    return data || [];
  },
  staleTime: 5 * 60 * 1000,
});
```

Isso garante que a mesma query key `['acquisition-closers', bu]` seja usada nos dois componentes, compartilhando cache automaticamente.

### Etapa 2: Filtrar attendees por closers da BU no SalesReportPanel

No `CloserRevenueSummaryTable`, a atribuicao ja filtra por `closers` passados como prop. Ao corrigir a lista de closers (Etapa 1), o matching automaticamente excluira closers de outras BUs.

### Etapa 3: Sincronizar attendee query keys

O `SalesReportPanel` usa `queryKey: ['attendees-for-sales-matching', ...]` e o `AcquisitionReport` usa `['attendees-acquisition-sdr', ...]`. Unificar para a mesma query key para garantir cache compartilhado e dados identicos:

```typescript
// Ambos passam a usar:
queryKey: ['attendees-acquisition-sdr', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()]
```

### Etapa 4: Incluir filtro de BU nos attendees do SalesReportPanel

A query de attendees do SalesReportPanel nao filtra por closer da BU. Adicionar a mesma logica do AcquisitionReport que exclui attendees cujo `closer_id` nao pertence a BU.

### Arquivos modificados

- `src/components/relatorios/SalesReportPanel.tsx` - Trocar query de closers e attendees para usar mesmas queries do AcquisitionReport
- `src/components/relatorios/CloserRevenueSummaryTable.tsx` - Nenhuma alteracao necessaria (ja recebe closers como prop)

### Resultado esperado

- Clicar em "Vendas" e "Aquisicao & Origem" mostrara os mesmos numeros por Closer
- Os dados serao cache-compartilhados (mesma queryKey) para evitar requisicoes duplicadas
- A filtragem por BU sera consistente em ambas as visoes

