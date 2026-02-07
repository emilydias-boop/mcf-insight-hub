
# Corrigir Inconsistência de Metas entre Cards e Formulário de KPIs

## Problema Identificado

Os cards de indicadores mostram metas diferentes do formulário "Editar KPIs" porque usam fontes de dados diferentes:

| Componente | Fonte | Dias Úteis | Meta Agendadas | Meta Realizadas |
|------------|-------|------------|----------------|-----------------|
| **Editar KPIs** (correto) | payout.dias_uteis_mes | 20 | 180 | 127 |
| **Cards** (errado) | compPlan.dias_uteis | 19 | 171 | 120 |

### Causa Raiz

O `DynamicIndicatorCard.tsx` prioriza o `compPlan.meta_reunioes_agendadas` (linha 147), que foi salvo com 19 dias úteis e nunca foi atualizado quando o mês passou a ter 20 dias úteis.

O `payout.meta_agendadas_ajustada` contém a meta correta (recalculada pela Edge Function), mas não está sendo usada.

## Solucao

Modificar o `DynamicIndicatorCard` para priorizar as metas ajustadas do **payout** (que são recalculadas corretamente a cada fechamento):

```text
Hierarquia de metas (nova):
1. payout.meta_agendadas_ajustada (já recalculada com dias úteis corretos)
2. compPlan.meta_reunioes_agendadas (fallback se payout não tiver)
3. sdrMetaDiaria * diasUteisMes (fallback final)
```

## Alteracoes Tecnicas

### 1. Modificar DynamicIndicatorCard.tsx

Atualizar a lógica de cálculo de metas para usar os campos do payout:

Para **agendamentos**:
```typescript
// ANTES (errado):
metaAjustada = compPlan?.meta_reunioes_agendadas || (sdrMetaDiaria * diasUteisMes);

// DEPOIS (correto):
metaAjustada = payout.meta_agendadas_ajustada 
  || compPlan?.meta_reunioes_agendadas 
  || (sdrMetaDiaria * diasUteisMes);
```

Para **realizadas**:
```typescript
// ANTES (errado):
const metaTeoricaAgendadas = compPlan?.meta_reunioes_agendadas || (sdrMetaDiaria * diasUteisMes);
metaAjustada = Math.round(metaTeoricaAgendadas * 0.7);

// DEPOIS (correto):
metaAjustada = payout.meta_realizadas_ajustada
  || compPlan?.meta_reunioes_realizadas
  || Math.round((payout.meta_agendadas_ajustada || sdrMetaDiaria * diasUteisMes) * 0.7);
```

Para **tentativas**:
```typescript
// ANTES:
metaAjustada = (payout as any).meta_tentativas_ajustada ?? (84 * diasUteisMes);

// Este já está correto, usando payout primeiro
```

### 2. Atualizar a meta diária exibida

Recalcular a meta diária a partir da meta ajustada para consistência visual:

```typescript
if (metrica.nome_metrica === 'agendamentos') {
  metaAjustada = payout.meta_agendadas_ajustada 
    || compPlan?.meta_reunioes_agendadas 
    || (sdrMetaDiaria * diasUteisMes);
  meta = Math.round(metaAjustada / diasUteisMes); // Meta diária derivada
}
```

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/fechamento/DynamicIndicatorCard.tsx` | Priorizar metas do payout sobre compPlan |

## Resultado Esperado

Apos a correcao, ambas as telas mostrarao as mesmas metas:

| Indicador | Meta (Editar KPIs) | Meta (Card) |
|-----------|-------------------|-------------|
| Agendamentos R1 | 180 (9/dia × 20) | 180 (9/dia) |
| R1 Realizadas | 127 (70% de 181) | 126 (70% de 180) |
| Tentativas | 1680 (84/dia × 20) | 1680 (84/dia) |

Nota: A pequena diferença em R1 Realizadas (127 vs 126) ocorre porque:
- KpiEditForm usa 70% do **realizado** (181 × 0.7 = 126.7 ≈ 127)
- Card usa 70% da **meta** (180 × 0.7 = 126)

Ambos são validos, mas o card deveria usar a meta do payout para consistencia visual.
