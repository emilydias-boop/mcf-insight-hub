
# Plano: Persistência e Carregamento Instantâneo dos Relatórios

## Problemas Identificados

1. **Recarrega ao sair da página**: `refetchOnWindowFocus` está no default (`true`), causando refetch sempre que o usuário volta à aba
2. **`staleTime` muito curto**: Apenas 2 minutos - dados são considerados "stale" rapidamente
3. **Sem dados de placeholder**: Não usa `keepPreviousData`, então mostra loading spinner enquanto busca novos dados

## Solução

Atualizar os hooks de relatório para:
- Desabilitar refetch ao focar janela
- Aumentar tempo de cache
- Mostrar dados anteriores enquanto atualiza em background

---

## Alterações Necessárias

### 1. Hook: `src/hooks/useContractReport.ts`

Atualizar configuração do useQuery (linha 40-221):

```typescript
return useQuery({
  queryKey: ['contract-report', filters, allowedCloserIds],
  queryFn: async (): Promise<ContractReportRow[]> => {
    // ... queryFn existente (sem alterações)
  },
  enabled: filters.startDate instanceof Date && filters.endDate instanceof Date,
  
  // NOVAS CONFIGURAÇÕES:
  staleTime: 10 * 60 * 1000,        // 10 minutos - dados não são refetchados automaticamente
  gcTime: 30 * 60 * 1000,           // 30 minutos - mantém em cache mesmo após unmount
  refetchOnWindowFocus: false,       // NÃO refetch ao voltar para a aba
  refetchOnReconnect: false,         // NÃO refetch ao reconectar internet
  placeholderData: (previousData) => previousData, // Mostra dados anteriores instantaneamente
});
```

### 2. Hook: `src/hooks/useHublaA000Contracts.ts`

Mesma atualização (linha 24-71):

```typescript
return useQuery({
  queryKey: ['hubla-a000-contracts', filters],
  queryFn: async (): Promise<HublaA000Transaction[]> => {
    // ... queryFn existente (sem alterações)
  },
  enabled: filters.startDate instanceof Date && filters.endDate instanceof Date,
  
  // NOVAS CONFIGURAÇÕES:
  staleTime: 10 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  placeholderData: (previousData) => previousData,
});
```

### 3. Query de Origens em `ContractReportPanel.tsx`

Atualizar a query de origens (linha 70-83) para manter consistência:

```typescript
const { data: origins = [] } = useQuery<OriginOption[]>({
  queryKey: ['crm-origins-simple'],
  queryFn: async (): Promise<OriginOption[]> => {
    // ... queryFn existente
  },
  staleTime: 30 * 60 * 1000,       // 30 minutos (origens mudam raramente)
  gcTime: 60 * 60 * 1000,          // 1 hora
  refetchOnWindowFocus: false,
});
```

---

## Comportamento Após Alterações

| Cenário | Antes | Depois |
|---------|-------|--------|
| Sair da aba e voltar | Mostra loading, refetch | Mostra dados instantaneamente |
| Mudar filtros | Loading completo | Mostra dados antigos + atualiza em background |
| Fechar página e reabrir (< 30min) | Loading completo | Dados do cache + atualiza silenciosamente |
| Dados com > 10min | Refetch automático | Mantém cache, só atualiza se usuário forçar |

---

## Fluxo Visual

```text
Usuário abre relatório
    |
    V
Cache existe? ─── SIM ─── Mostra instantaneamente
    |                          |
   NÃO                    Background: verifica se stale
    |                          |
    V                          V
Mostra loading        Se stale (>10min): atualiza silenciosamente
    |
    V
Busca dados
    |
    V
Armazena em cache (30min)
```

---

## Resultado Esperado

1. **Instantâneo**: Tabela aparece imediatamente ao entrar na página (sem spinner)
2. **Persistente**: Dados mantidos ao trocar abas/apps
3. **Background refresh**: Atualizações ocorrem silenciosamente sem bloquear a UI
