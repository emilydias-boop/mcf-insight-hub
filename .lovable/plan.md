
# Plano: Corrigir Etapas não Aparecendo no Kanban (Efeito Alavanca + Clube)

## Diagnóstico Final

### Evidências Coletadas:
| Fonte | Origin ID | Tabela Consultada | Resultado |
|-------|-----------|-------------------|-----------|
| Banco (SQL direto) | `7d7b1cb5...` | `local_pipeline_stages` | 13 etapas ativas |
| Frontend (Network) | `7d7b1cb5...` | `crm_stages` | 0 etapas (tabela legada) |
| Frontend (Network) | `a1b2c3d4...` | `local_pipeline_stages` | 8 etapas (Pipeline Leilão funciona!) |

### Causa Raiz:
O React Query cacheou uma resposta **vazia** para `useCRMStages('7d7b1cb5...')` em um momento **antes** de você criar as 13 etapas (criadas às 17:13/17:22). O cache persiste e o sistema não re-consulta `local_pipeline_stages`.

O fluxo problemático:
1. Você acessou "Efeito Alavanca + Clube" ANTES de criar as etapas
2. React Query armazenou: `queryKey: ['crm-stages', '7d7b1cb5...'] → []`
3. Ao criar etapas no wizard/configurações, o cache não foi invalidado
4. Toda vez que você acessa essa origem, retorna o cache vazio

---

## Solução

### Parte 1: Invalidar Cache Após Criar/Editar Estágios

Quando estágios são criados no wizard ou editados na aba Configurações, precisamos invalidar o cache de `['crm-stages', originId]`.

**Arquivo:** `src/hooks/useCreatePipeline.ts`

```typescript
// Após criar estágios, invalidar o cache
queryClient.invalidateQueries({ 
  queryKey: ['crm-stages'] 
});
```

**Arquivo:** Componente de edição de estágios (PipelineSettings ou similar)

```typescript
// Após salvar mudanças em estágios
queryClient.invalidateQueries({ 
  queryKey: ['crm-stages', originId] 
});
```

### Parte 2: Ajustar `staleTime` do Hook

Atualmente o hook `useCRMStages` não define `staleTime`, usando o padrão de 0ms (cache válido indefinidamente até refetch). Mas como não há refetch automático ao navegar, o cache persiste.

**Arquivo:** `src/hooks/useCRMData.ts`

```typescript
export const useCRMStages = (originOrGroupId?: string) => {
  return useQuery({
    queryKey: ['crm-stages', originOrGroupId],
    queryFn: async () => { /* ... */ },
    staleTime: 30000, // 30 segundos - forçar refetch após esse tempo
  });
};
```

### Parte 3: Adicionar Log de Debug (Temporário)

Para confirmar que a query para `local_pipeline_stages` está funcionando:

**Arquivo:** `src/hooks/useCRMData.ts`

```typescript
// Dentro do bloco else (linha 63-73)
const result = await supabase
  .from('local_pipeline_stages')
  .select('*')
  .eq('origin_id', originOrGroupId)
  .eq('is_active', true)
  .order('stage_order');

console.log('[useCRMStages] local_pipeline_stages query:', {
  originId: originOrGroupId,
  data: result.data,
  error: result.error,
});

localStages = result.data;
localError = result.error;
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useCRMData.ts` | Adicionar `staleTime: 30000` e log de debug |
| `src/hooks/useCreatePipeline.ts` | Invalidar cache `['crm-stages']` após criar pipeline |
| `src/components/crm/PipelineSettings.tsx` ou equivalente | Invalidar cache após editar estágios |

---

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Acessar "Efeito Alavanca + Clube" | "Nenhum estágio configurado" | 13 etapas no Kanban |
| Criar novas etapas em qualquer origem | Cache antigo persiste | Cache invalidado, mostra novas etapas |
| Trocar de origem no sidebar | Pode mostrar dados obsoletos | Dados atualizados após 30s ou após edição |

---

## Solução Imediata (Workaround)

Enquanto as correções não são aplicadas, você pode forçar o refetch:
1. Abra DevTools (F12)
2. Vá na aba Application → Storage → Clear site data
3. Recarregue a página

Isso limpará o cache do React Query e forçará novas consultas.
