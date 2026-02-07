
# Sincronizar Fórmulas: Editar KPIs → Indicadores de Meta

## Problema Identificado

As fórmulas de cálculo de meta estão **diferentes** entre os dois lugares:

### Fórmula no "Editar KPIs" (CORRETA)
```
Agendamentos: Meta = 10/dia × 20 dias = 200
Realizadas:   Meta = 70% de 169 (agendadas REAIS) = 118 ✅
```

### Fórmula nos "Indicadores de Meta" (ERRADA)
```
Agendamentos: Meta = 10/dia × 20 dias = 200
Realizadas:   Meta = 70% de 200 (meta TEÓRICA) = 140 ❌
```

A diferença: O "Editar KPIs" usa **70% das agendadas REAIS** (169), enquanto os "Indicadores de Meta" usam **70% da meta teórica** (200).

---

## Solução

Alterar o cálculo nos "Indicadores de Meta" para usar a mesma lógica do "Editar KPIs":

### Código Atual (DynamicIndicatorCard.tsx - linha 148-153)
```typescript
} else if (metrica.nome_metrica === 'realizadas') {
  // Usar a meta teórica de agendadas do compPlan ou calcular
  const metaTeoricaAgendadas = compPlan?.meta_reunioes_agendadas || (sdrMetaDiaria * diasUteisMes);
  meta = Math.round(metaTeoricaAgendadas / diasUteisMes);
  metaAjustada = Math.round(metaTeoricaAgendadas * 0.7);  // ❌ 70% da meta TEÓRICA
}
```

### Código Novo (como vai ficar)
```typescript
} else if (metrica.nome_metrica === 'realizadas') {
  // NOVO: Usar 70% das agendadas REAIS (igual ao KpiEditForm)
  const agendadasReais = kpi?.reunioes_agendadas || 0;
  meta = agendadasReais;
  metaAjustada = Math.round(agendadasReais * 0.7);  // ✅ 70% das agendadas REAIS
}
```

---

## Exemplo Visual - Como Vai Ficar

### Antes (errado)
| Indicador | Meta | Realizado | % |
|-----------|------|-----------|---|
| Agendamentos | 200 | 169 | 84.5% |
| Realizadas | **140** (70% de 200) | 110 | **78.6%** |

### Depois (correto - igual ao Editar KPIs)
| Indicador | Meta | Realizado | % |
|-----------|------|-----------|---|
| Agendamentos | 200 | 169 | 84.5% |
| Realizadas | **118** (70% de 169) | 110 | **93.2%** |

A porcentagem sobe de 78.6% para 93.2% porque a meta ajustada (118) reflete melhor a produtividade real.

---

## Arquivos a Alterar

### 1. DynamicIndicatorCard.tsx
Mudar a lógica de cálculo da meta de "realizadas" para usar as agendadas reais do KPI.

### 2. useCalculatedVariavel.ts  
Sincronizar a mesma lógica para manter consistência no cálculo do variável total.

---

## Resumo Técnico

| Componente | Arquivo | Mudança |
|------------|---------|---------|
| Indicadores de Meta | `src/components/fechamento/DynamicIndicatorCard.tsx` | Linha 148-153: usar `kpi?.reunioes_agendadas` em vez de `metaTeoricaAgendadas` |
| Cálculo Variável | `src/hooks/useCalculatedVariavel.ts` | Linha 77-80: mesma mudança para consistência |

Ambos passarão a usar: `metaAjustada = Math.round(kpi.reunioes_agendadas * 0.7)`
