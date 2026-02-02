
# Plano: Corrigir Salvamento e Exibição de Métricas Ativas

## Problemas Identificados

### 1. Métricas não salvam corretamente (voltam ao anterior)
**Causa raiz:** O sistema usa `upsert` com a constraint `(ano_mes, cargo_catalogo_id, squad, nome_metrica)`, mas no PostgreSQL, **NULL != NULL** em unique constraints. Então cada save cria NOVOS registros em vez de atualizar os existentes quando `squad=null`.

Evidência no banco:
```
cargo_catalogo_id: c2909e20... (Closer Inside N1)
Métricas com squad=null:
- contratos: 3 registros duplicados!
- organizacao: 3 registros duplicados!
```

### 2. Métricas desativadas não são removidas
O `handleSave` só faz upsert das métricas ativas, mas **não deleta as antigas** que foram desligadas. Quando a página recarrega, as antigas ainda aparecem.

### 3. Conflito entre squad=null e squad específico
Quando salva com "BU: Todas" (`squad=null`), cria registros com `squad=null`. Quando muda para "BU: Incorporador", cria novos registros com `squad='incorporador'`. Ambos coexistem e causam confusão.

### 4. Métricas não aparecem corretamente no popup
O `useActiveMetricsForCargo` não encontra métricas porque consulta com `squad=undefined` mas no banco existem com `squad=null` ou `squad='incorporador'`.

---

## Solução: Delete + Insert ao Salvar

Modificar o fluxo de salvamento para:
1. **DELETAR todas as métricas existentes** para o cargo/squad/mês
2. **INSERIR as novas métricas** ativas selecionadas

Isso garante que:
- Métricas desativadas sejam removidas
- Não haja duplicatas por causa de NULL
- O estado final reflita exatamente o que foi configurado

---

## Alterações Técnicas

### 1. Modificar `useBulkUpsertMetricas` em `useFechamentoMetricas.ts`

Trocar a lógica de "upsert simples" para "delete + insert":

```typescript
export const useBulkUpsertMetricas = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (metricas: Array<...> & { 
      // Adicionar parâmetro para delete
      _deleteConfig?: { 
        anoMes: string; 
        cargoId: string | null; 
        squad: string | null; 
      } 
    }) => {
      const deleteConfig = metricas[0]?._deleteConfig;
      
      // Step 1: DELETE existing metrics for this cargo/squad/month
      if (deleteConfig) {
        let deleteQuery = supabase
          .from('fechamento_metricas_mes')
          .delete()
          .eq('ano_mes', deleteConfig.anoMes);
        
        if (deleteConfig.cargoId) {
          deleteQuery = deleteQuery.eq('cargo_catalogo_id', deleteConfig.cargoId);
        } else {
          deleteQuery = deleteQuery.is('cargo_catalogo_id', null);
        }
        
        if (deleteConfig.squad) {
          deleteQuery = deleteQuery.eq('squad', deleteConfig.squad);
        } else {
          deleteQuery = deleteQuery.is('squad', null);
        }
        
        await deleteQuery;
      }
      
      // Step 2: INSERT new active metrics
      const { data, error } = await supabase
        .from('fechamento_metricas_mes')
        .insert(metricas.map(m => ({
          ...m,
          _deleteConfig: undefined // Remove meta field
        })))
        .select();
      
      if (error) throw error;
      return data;
    },
    // ... rest
  });
};
```

### 2. Modificar `handleSave` em `ActiveMetricsTab.tsx`

Passar o contexto de delete junto com as métricas:

```typescript
const handleSave = async () => {
  const cargoId = selectedCargoId === '__all__' ? null : selectedCargoId;
  const squad = selectedSquad === '__all__' ? null : selectedSquad;
  
  const metricasToSave = localMetrics
    .filter(m => m.ativo)
    .map((m, index) => ({
      ano_mes: anoMes,
      cargo_catalogo_id: cargoId,
      squad: squad,
      nome_metrica: m.nome_metrica,
      label_exibicao: m.label_exibicao,
      peso_percentual: m.peso_percentual,
      meta_valor: m.meta_valor,
      fonte_dados: m.fonte_dados,
      ativo: true,
      // Include delete config only on first item
      ...(index === 0 ? {
        _deleteConfig: { anoMes, cargoId, squad }
      } : {})
    }));

  // ... validations and save
};
```

### 3. Corrigir consulta em `useActiveMetricsForCargo`

Tratar `squad=undefined` como "buscar sem filtro de squad":

```typescript
// Quando não tem squad especificado, buscar métricas sem squad OU qualquer squad
if (squad) {
  query = query.eq('squad', squad);
} else {
  // Buscar métricas sem squad definido (genéricas para o cargo)
  query = query.is('squad', null);
}
```

### 4. Corrigir consulta no `useFechamentoMetricas` (ActiveMetricsTab)

Similar ao acima, garantir que quando `squad=undefined`:
- Se queremos métricas "genéricas" do cargo: filtrar `.is('squad', null)`
- Se queremos TODAS as métricas (incluindo por BU): não filtrar por squad

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useFechamentoMetricas.ts` | Trocar upsert por delete+insert no `useBulkUpsertMetricas` |
| `src/components/fechamento/ActiveMetricsTab.tsx` | Ajustar `handleSave` para passar contexto de delete |
| `src/hooks/useActiveMetricsForSdr.ts` | Corrigir `useActiveMetricsForCargo` para usar `.is('squad', null)` |

---

## Limpeza de Dados (SQL)

Para corrigir os duplicados existentes, executar SQL:

```sql
-- Remove duplicados mantendo apenas o registro mais recente
DELETE FROM fechamento_metricas_mes a
USING fechamento_metricas_mes b
WHERE a.id < b.id
  AND a.ano_mes = b.ano_mes
  AND a.cargo_catalogo_id IS NOT DISTINCT FROM b.cargo_catalogo_id
  AND a.squad IS NOT DISTINCT FROM b.squad
  AND a.nome_metrica = b.nome_metrica;
```

---

## Fluxo Corrigido

```text
ANTES (problema):
┌───────────────────────────────────────────────────┐
│ Save: contratos (50%) + organização (50%)         │
├───────────────────────────────────────────────────┤
│ Banco: UPSERT → NULL não combina → INSERT NOVO   │
│                                                   │
│ Resultado: 3x contratos, 3x organização, etc.    │
│ Reload: Mostra as antigas (4 métricas 25%)       │
└───────────────────────────────────────────────────┘

DEPOIS (corrigido):
┌───────────────────────────────────────────────────┐
│ Save: contratos (50%) + organização (50%)         │
├───────────────────────────────────────────────────┤
│ Banco:                                            │
│ 1. DELETE WHERE cargo=X AND squad=Y AND mes=Z    │
│ 2. INSERT contratos (50%), organizacao (50%)     │
│                                                   │
│ Resultado: Apenas 2 métricas (50% + 50%)         │
│ Reload: Mostra exatamente o que foi salvo        │
└───────────────────────────────────────────────────┘
```

---

## Resultado Esperado

1. **Salvar métricas funciona corretamente**: Toggle off remove, toggle on adiciona
2. **Peso percentual persiste**: 50% + 50% = 100% salva e recarrega certo
3. **Popup mostra métricas corretas**: Closer N1 com métricas configuradas aparece corretamente
4. **Sem duplicatas**: Cada combinação cargo/squad/mes/metrica tem apenas 1 registro
