
# Plano: Corrigir Fallback de Métricas para Cargos Sem Configuração

## Problema Identificado

Thaynar Tavares é **Closer Inside N2** (cargo: `fd8d5a86-4687-4e89-b00d-84e7e5bcd563`), mas:

1. Não há métricas ativas configuradas para **Closer Inside N2** no mês 2026-01
2. Só há métricas configuradas para **Closer Inside N1** (cargo diferente)
3. O hook `useActiveMetricsForCargo` retorna array vazio
4. O dialog exibe campos padrão de **SDR** (Agendadas, Realizadas, Tentativas, Organização)

## Causa Raiz

O `useActiveMetricsForCargo` não possui lógica de fallback inteligente:
- Quando não encontra métricas configuradas, retorna `[]`
- O dialog então exibe campos hardcoded de SDR (comportamento incorreto)
- Deveria usar métricas padrão de Closer quando o cargo é de Closer

## Solução

Modificar o hook `useActiveMetricsForCargo` para:
1. Buscar informações do cargo (nome_exibicao) 
2. Detectar se é cargo de Closer baseado no nome
3. Retornar métricas de fallback corretas (Closer ou SDR)

---

## Alterações Técnicas

### Arquivo: `src/hooks/useActiveMetricsForSdr.ts`

**Função `useActiveMetricsForCargo`** - Adicionar lógica de fallback:

```typescript
export const useActiveMetricsForCargo = (cargoId: string | undefined, anoMes: string, squad?: string) => {
  return useQuery({
    queryKey: ['active-metrics-for-cargo', cargoId, anoMes, squad],
    queryFn: async () => {
      if (!cargoId || !anoMes) {
        return [];
      }

      // Step 1: Fetch cargo info to determine if it's a Closer role
      const { data: cargoData } = await supabase
        .from('cargos_catalogo')
        .select('nome_exibicao, area')
        .eq('id', cargoId)
        .single();

      const isCloserRole = cargoData?.nome_exibicao?.toLowerCase().includes('closer') || false;

      // Step 2: Query metrics for this cargo
      let query = supabase
        .from('fechamento_metricas_mes')
        .select('*')
        .eq('ano_mes', anoMes)
        .eq('cargo_catalogo_id', cargoId)
        .eq('ativo', true)
        .order('created_at', { ascending: true });

      if (squad) {
        query = query.eq('squad', squad);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching metrics for cargo:', error);
      }

      // Step 3: Return configured metrics OR fallback based on role type
      if (data && data.length > 0) {
        return data as ActiveMetric[];
      }

      // Return fallback metrics based on cargo type
      const fallbackMetrics = isCloserRole ? DEFAULT_CLOSER_METRICS : DEFAULT_SDR_METRICS;
      return fallbackMetrics as ActiveMetric[];
    },
    enabled: !!cargoId && !!anoMes,
    staleTime: 5 * 60 * 1000,
  });
};
```

---

## Fluxo Corrigido

```text
┌────────────────────────────────────────────────────────────────┐
│          ANTES (comportamento incorreto)                       │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  1. Abre popup para Thaynar (Closer Inside N2)                 │
│  2. useActiveMetricsForCargo busca métricas para N2            │
│  3. Não encontra nenhuma métrica configurada                   │
│  4. Retorna [] (array vazio)                                   │
│  5. Dialog exibe campos hardcoded de SDR ❌                    │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│          DEPOIS (comportamento correto)                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  1. Abre popup para Thaynar (Closer Inside N2)                 │
│  2. useActiveMetricsForCargo busca métricas para N2            │
│  3. Não encontra nenhuma métrica configurada                   │
│  4. Busca info do cargo: "Closer Inside N2"                    │
│  5. Detecta que nome contém "closer"                           │
│  6. Retorna DEFAULT_CLOSER_METRICS como fallback ✅            │
│  7. Dialog exibe: R1 Realizadas, Contratos, R2, Organização    │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

Após a correção, o popup "Editar Plano Individual" para Thaynar (Closer Inside N2) exibirá:

| Antes (Errado) | Depois (Correto) |
|----------------|------------------|
| Agendadas (R$) | R1 Realizadas (R$) |
| Realizadas (R$) | Contratos Pagos (R$) |
| Tentativas (R$) | R2 Agendadas (R$) |
| Organização (R$) | Organização (R$) |

Os campos corretos de Closer serão exibidos mesmo sem métricas específicas configuradas para o cargo N2.

---

## Alternativa: Configurar Métricas para N2

Você também pode configurar métricas para **Closer Inside N2** na aba "Métricas Ativas":

1. Selecionar cargo: Closer Inside N2
2. Adicionar métricas: R1 Realizadas, Contratos Pagos, R2 Agendadas, Organização
3. Definir pesos (25% cada)

Isso daria controle total sobre as métricas de cada nível separadamente.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useActiveMetricsForSdr.ts` | Adicionar fallback inteligente em `useActiveMetricsForCargo` baseado no nome do cargo |

## Impacto

- **Baixo risco**: Apenas adiciona lógica de fallback
- **Sem breaking changes**: Cargos com métricas configuradas continuam funcionando igual
- **Benefício**: Todos os cargos de Closer terão fallback correto automaticamente
