
# Plano: Atualização Real-Time do Relatório R2

## Objetivo

Fazer com que o relatório de qualificação R2 atualize automaticamente quando:
1. Status de reunião é alterado (completed, no_show, etc.)
2. Campos de qualificação são preenchidos (estado, renda, profissão, etc.)
3. Novas reuniões são agendadas

## Abordagem

O projeto já utiliza `refetchInterval` do React Query para atualizações periódicas em diversos hooks (30-60 segundos). Esta é a abordagem mais simples e consistente com o padrão existente.

**Por que refetchInterval?**
| Aspecto | refetchInterval | Supabase Realtime |
|---------|-----------------|-------------------|
| Complexidade | Baixa (1 linha) | Alta (setup channel) |
| Padrão no projeto | Usado em 29+ hooks | Não utilizado |
| Confiabilidade | Alta | Requer conexão ativa |
| Custo | Polling leve | Conexão persistente |

## Mudanças

### 1. Hook `useR2QualificationReport.ts`

Adicionar `refetchInterval` e `staleTime` para atualização automática a cada 30 segundos:

**Arquivo:** `src/hooks/useR2QualificationReport.ts`

```typescript
export function useR2QualificationReport(filters: QualificationFilters) {
  return useQuery({
    queryKey: ['r2-qualification-report', ...],
    queryFn: async () => { ... },
    // ADICIONAR ESTAS LINHAS:
    staleTime: 30000,        // Dados considerados "frescos" por 30 segundos
    refetchInterval: 30000,  // Atualizar automaticamente a cada 30 segundos
  });
}
```

### 2. Indicador Visual de Atualização (Opcional)

Adicionar um indicador discreto mostrando quando os dados foram atualizados pela última vez:

**Arquivo:** `src/components/crm/R2QualificationReportPanel.tsx`

```tsx
const { data, isLoading, isFetching, dataUpdatedAt } = useR2QualificationReport({...});

// No header do painel:
<div className="flex items-center gap-2 text-xs text-muted-foreground">
  {isFetching && !isLoading && (
    <Loader2 className="h-3 w-3 animate-spin" />
  )}
  <span>
    Atualizado: {format(new Date(dataUpdatedAt), 'HH:mm:ss')}
  </span>
</div>
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useR2QualificationReport.ts` | Adicionar `staleTime: 30000` e `refetchInterval: 30000` |
| `src/components/crm/R2QualificationReportPanel.tsx` | (Opcional) Adicionar indicador visual de última atualização |

## Comportamento Final

1. **Auto-refresh a cada 30 segundos**: O relatório busca novos dados automaticamente
2. **Indicador visual**: Usuário vê quando os dados foram atualizados
3. **Sem piscar**: O `staleTime` evita recarregamentos visuais desnecessários
4. **Consistente**: Mesmo padrão usado em outros dashboards do sistema

## Fluxo de Atualização

```text
┌─────────────────────────────────────────────────────────────┐
│ Usuário preenche qualificação no Drawer R2                  │
│         ↓                                                   │
│ Dados salvos em crm_deals.custom_fields                     │
│         ↓                                                   │
│ [30 segundos]                                               │
│         ↓                                                   │
│ React Query dispara refetch automático                      │
│         ↓                                                   │
│ Relatório atualizado com novos gráficos e métricas         │
└─────────────────────────────────────────────────────────────┘
```
