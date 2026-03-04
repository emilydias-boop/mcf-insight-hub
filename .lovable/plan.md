

## Problema

O indicador "Contratos Pagos" para SDRs mostra **Meta: 17 (1/dia)** porque `meta_percentual` não está configurado no banco, e o código usa fallback de `meta_valor=1 × dias_uteis`. O correto é **30% das Reuniões Realizadas** (ex: 52 realizadas → meta 16, com 13 contratos = 81.3%).

Além disso, a meta description no formulário "Editar KPIs" usa `reunioes_agendadas` em vez de `reunioes_realizadas`.

## Correção (3 arquivos)

### 1. `src/components/fechamento/DynamicKpiField.tsx` (linha 184-186)
Corrigir `getMetaDescription` para usar `reunioes_realizadas`:
```typescript
case 'contratos':
  const realizadas_contratos = formData.reunioes_realizadas || 0;
  return `Meta: ${Math.round(realizadas_contratos * 0.3)} (30% de ${realizadas_contratos} realizadas)`;
```

### 2. `src/components/fechamento/DynamicIndicatorCard.tsx` (linhas 96-109)
No bloco `isDynamicCalc`, adicionar fallback para contratos quando `meta_percentual` não está configurado — usar 30% das realizadas:
```typescript
if (metrica.meta_percentual && metrica.meta_percentual > 0) {
  // Configurado no DB
  const realizadas = kpi?.reunioes_realizadas || 0;
  metaAjustada = Math.round((realizadas * metrica.meta_percentual) / 100);
  metaDiaria = metrica.meta_percentual;
} else if (metrica.nome_metrica === 'contratos') {
  // Fallback SDR: 30% das realizadas
  const realizadas = kpi?.reunioes_realizadas || 0;
  metaAjustada = Math.round(realizadas * 0.3);
  metaDiaria = 30; // 30%
} else {
  metaDiaria = metrica.meta_valor || 1;
  metaAjustada = metaDiaria * diasUteisMes;
}
```
E atualizar o `metaSubtitle` para incluir este caso.

### 3. `src/hooks/useCalculatedVariavel.ts` (linhas 69-79)
Mesma lógica de fallback para manter consistência no cálculo do variável total:
```typescript
if (metrica.meta_percentual && metrica.meta_percentual > 0) {
  const realizadas = kpi?.reunioes_realizadas || 0;
  metaAjustada = Math.round((realizadas * metrica.meta_percentual) / 100);
} else if (metrica.nome_metrica === 'contratos') {
  const realizadas = kpi?.reunioes_realizadas || 0;
  metaAjustada = Math.round(realizadas * 0.3);
} else {
  const metaDiaria = metrica.meta_valor || 1;
  metaAjustada = metaDiaria * diasUteisMes;
}
```

### Resultado
- Formulário KPIs: "Meta: 16 (30% de 52 realizadas)"
- Indicador: Meta: 16, Realizado: 13, **81.3%**, Faixa 71-85%, Multiplicador 0.5x
- Variável total recalculado consistentemente

