
# Plano: Transferência em Massa + Filtros Avançados no Kanban de Negócios

## Visão Geral

Este plano implementa três novas funcionalidades na página de Negócios:

1. **Transferência em massa de leads** - Selecionar múltiplos leads e transferir para um SDR
2. **Filtro por atividade** - Filtrar leads por tempo desde a última atividade
3. **Filtro por canal de entrada** - Filtrar por tipo de lead (LIVE, A010, etc.)

---

## 1. Transferência em Massa

### Experiência do Usuário

1. Um botão "Modo de Seleção" ativa checkboxes nos cards do Kanban
2. Ao selecionar leads, uma barra de ações aparece mostrando:
   - Quantidade selecionada
   - Botão "Transferir para..." que abre o diálogo de seleção de SDR
   - Botão para cancelar seleção
3. Ao confirmar, todos os leads são transferidos e o sistema registra atividade em cada um

### Componentes a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/crm/BulkActionsBar.tsx` | **Criar** - Barra flutuante com ações em massa |
| `src/components/crm/BulkTransferDialog.tsx` | **Criar** - Diálogo para transferência em massa (reutiliza lógica do OwnerChangeDialog) |
| `src/hooks/useBulkTransfer.ts` | **Criar** - Hook para transferir múltiplos deals |
| `src/components/crm/DealKanbanCard.tsx` | **Modificar** - Adicionar checkbox quando modo de seleção ativo |
| `src/components/crm/DealKanbanBoard.tsx` | **Modificar** - Gerenciar estado de seleção |
| `src/pages/crm/Negocios.tsx` | **Modificar** - Integrar modo de seleção e barra de ações |

### Lógica de Transferência em Massa

```text
useBulkTransfer.ts:
  Para cada dealId no array:
    1. UPDATE crm_deals SET owner_id = newOwnerEmail
    2. INSERT deal_activities (activity_type: 'owner_change', ...)
  
  Usar Promise.allSettled para processar em paralelo
  Mostrar progresso e resultado (X de Y transferidos)
```

---

## 2. Filtro por Tempo de Atividade

### Experiência do Usuário

No painel de filtros, adicionar:
- **"Sem atividade há"**: Dropdown com opções:
  - Qualquer
  - Mais de 1 dia
  - Mais de 3 dias
  - Mais de 7 dias
  - Mais de 15 dias
  - Mais de 30 dias

### Implementação

Como já existe o `useBatchDealActivitySummary` que retorna `lastContactAttempt` por deal, podemos filtrar no frontend:

```text
filteredDeals = deals.filter(deal => {
  if (!filters.inactivityDays) return true;
  
  const lastActivity = activitySummaries.get(deal.id)?.lastContactAttempt;
  if (!lastActivity) return true; // Sem atividade = muito tempo inativo
  
  const daysSince = differenceInDays(new Date(), new Date(lastActivity));
  return daysSince >= filters.inactivityDays;
});
```

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/crm/DealFilters.tsx` | Adicionar dropdown de inatividade |
| `src/pages/crm/Negocios.tsx` | Passar activitySummaries para filtro e aplicar lógica |

---

## 3. Filtro por Canal de Entrada

### Experiência do Usuário

No painel de filtros, adicionar:
- **"Canal"**: Dropdown com opções:
  - Todos
  - A010 (leads que compraram produto A010)
  - LIVE (leads gratuitos de lives)

### Implementação

O hook `useA010Journey` já identifica se um lead é A010 ou LIVE. Para filtro em massa, precisamos:

1. Buscar dados de `hubla_transactions` para todos os emails dos deals exibidos
2. Criar um Map de email → isA010
3. Filtrar deals baseado nesse Map

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/crm/DealFilters.tsx` | Adicionar dropdown de canal |
| `src/pages/crm/Negocios.tsx` | Integrar filtro de canal |
| `src/hooks/useBulkA010Check.ts` | **Criar** - Hook para verificar A010 em batch |

---

## Interface Atualizada dos Filtros

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🔍 Buscar por nome, email ou telefone...                                     │
├────────────────┬────────────────┬────────────────┬─────────────┬─────────────┤
│   Status ▼     │ Responsável ▼  │  Sem ativ. ▼   │   Canal ▼   │ 📅 Data    │
│   Todos        │ Todos          │  Qualquer      │   Todos     │             │
└────────────────┴────────────────┴────────────────┴─────────────┴─────────────┘
                                                       [ Modo Seleção ]
```

---

## Detalhes Técnicos

### DealFiltersState Atualizado

```typescript
export interface DealFiltersState {
  search: string;
  dateRange: DateRange | undefined;
  owner: string | null;
  dealStatus: 'all' | 'open' | 'won' | 'lost';
  // NOVOS CAMPOS:
  inactivityDays: number | null;  // null = qualquer, 1, 3, 7, 15, 30
  salesChannel: 'all' | 'a010' | 'live';
}
```

### BulkActionsBar Component

```typescript
interface BulkActionsBarProps {
  selectedCount: number;
  onTransfer: () => void;
  onClearSelection: () => void;
  isTransferring: boolean;
}
```

Aparece fixo na parte inferior quando há seleções:

```text
┌────────────────────────────────────────────────────────────────┐
│  ✓ 12 leads selecionados    [ Transferir para... ]  [ Limpar ] │
└────────────────────────────────────────────────────────────────┘
```

### useBulkTransfer Hook

```typescript
interface BulkTransferParams {
  dealIds: string[];
  newOwnerEmail: string;
  newOwnerName: string;
}

export const useBulkTransfer = () => {
  return useMutation({
    mutationFn: async ({ dealIds, newOwnerEmail, newOwnerName }) => {
      const results = await Promise.allSettled(
        dealIds.map(async (dealId) => {
          // 1. Buscar owner atual
          const { data: deal } = await supabase
            .from('crm_deals')
            .select('owner_id')
            .eq('id', dealId)
            .single();
          
          // 2. Atualizar owner
          await supabase
            .from('crm_deals')
            .update({ owner_id: newOwnerEmail })
            .eq('id', dealId);
          
          // 3. Registrar atividade
          await supabase
            .from('deal_activities')
            .insert({
              deal_id: dealId,
              activity_type: 'owner_change',
              description: `Transferido para ${newOwnerName} (em massa)`,
              metadata: { ... }
            });
        })
      );
      
      return {
        total: dealIds.length,
        success: results.filter(r => r.status === 'fulfilled').length,
        failed: results.filter(r => r.status === 'rejected').length
      };
    }
  });
};
```

### useBulkA010Check Hook

```typescript
export const useBulkA010Check = (emails: string[]) => {
  return useQuery({
    queryKey: ['bulk-a010-check', emails.sort().join(',')],
    queryFn: async () => {
      if (emails.length === 0) return new Map();
      
      const { data } = await supabase
        .from('hubla_transactions')
        .select('customer_email')
        .eq('product_category', 'a010')
        .eq('sale_status', 'completed')
        .in('customer_email', emails);
      
      const a010Emails = new Set(data?.map(t => t.customer_email?.toLowerCase()) || []);
      
      return new Map(emails.map(email => [
        email.toLowerCase(), 
        a010Emails.has(email.toLowerCase())
      ]));
    },
    staleTime: 5 * 60 * 1000,
  });
};
```

---

## Resumo dos Arquivos

| Ação | Arquivo | Descrição |
|------|---------|-----------|
| Criar | `src/components/crm/BulkActionsBar.tsx` | Barra flutuante com ações em massa |
| Criar | `src/components/crm/BulkTransferDialog.tsx` | Modal de transferência em massa |
| Criar | `src/hooks/useBulkTransfer.ts` | Mutation para transferir múltiplos deals |
| Criar | `src/hooks/useBulkA010Check.ts` | Query para verificar A010 em batch |
| Editar | `src/components/crm/DealFilters.tsx` | Adicionar filtros de inatividade e canal |
| Editar | `src/components/crm/DealKanbanCard.tsx` | Adicionar checkbox em modo seleção |
| Editar | `src/components/crm/DealKanbanBoard.tsx` | Gerenciar estado de seleção |
| Editar | `src/pages/crm/Negocios.tsx` | Integrar todos os novos recursos |

---

## Resultado Esperado

- Botão "Modo Seleção" permite selecionar múltiplos leads com checkboxes
- Barra de ações aparece na parte inferior mostrando quantidade selecionada
- Transferência em massa funciona para qualquer quantidade de leads
- Filtro de inatividade mostra leads "esquecidos" sem atividade recente
- Filtro de canal diferencia leads A010 (compradores) de LIVE (gratuitos)
- Todos os filtros funcionam combinados
