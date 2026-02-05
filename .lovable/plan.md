
# Plano: Meta de Contratos Pagos Baseada em % das Realizadas

## Contexto do Problema

Atualmente, a meta de "Contratos Pagos" para Closers é calculada como:
- `Meta Diária × Dias Úteis` (ex: 20/dia × 20 dias = 400 contratos)

O usuário precisa que a meta seja calculada como:
- `Porcentagem × Realizadas` (ex: 30% × 230 realizadas = 69 contratos)

Isso representa a **taxa de conversão esperada** por nível do Closer.

---

## Estratégia de Solução

Adicionar um novo campo `meta_percentual` na tabela `fechamento_metricas_mes` para métricas onde a meta é dinâmica (baseada em outra métrica).

Quando `meta_percentual` está preenchido:
- A meta de contratos = `(realizadas × meta_percentual) / 100`
- Ignora o campo `meta_valor`

Quando `meta_percentual` está vazio:
- Continua usando `meta_valor × diasUteis` como antes

---

## Mudanças Técnicas

### 1. Banco de Dados (Migration)

Adicionar nova coluna na tabela `fechamento_metricas_mes`:

```sql
ALTER TABLE fechamento_metricas_mes 
ADD COLUMN meta_percentual numeric DEFAULT NULL;

COMMENT ON COLUMN fechamento_metricas_mes.meta_percentual IS 
  'Percentual para cálculo dinâmico da meta (ex: 30 = 30% das Realizadas para Contratos)';
```

### 2. Atualizar Types TypeScript

Adicionar `meta_percentual?: number | null` no tipo `FechamentoMetricaMes`.

### 3. Modificar `ActiveMetricsTab.tsx`

Na interface de configuração de métricas:
- Adicionar campo "Meta %" ao lado do campo "Meta" para a métrica "Contratos Pagos"
- Quando preenchido, exibir: `Meta: {X}% das Realizadas`

Layout proposto:
```text
Contratos Pagos   [Ativo] ✓
├─ Peso: [35] %
├─ Tipo Meta: ○ Valor Fixo  ● % Realizadas
└─ Meta %: [30] % → (30% das Realizadas)
```

### 4. Modificar `DynamicIndicatorCard.tsx`

No cálculo da métrica "contratos" (`isDynamicCalc = true`):

```typescript
// Antes:
const metaDiaria = metrica.meta_valor || 1;
const metaAjustada = metaDiaria * diasUteisMes;

// Depois:
let metaAjustada: number;
if (metrica.meta_percentual && metrica.meta_percentual > 0) {
  // Meta dinâmica: X% das Realizadas
  const realizadas = kpi?.reunioes_realizadas || 0;
  metaAjustada = Math.round((realizadas * metrica.meta_percentual) / 100);
} else {
  // Meta fixa: valor diário × dias úteis
  const metaDiaria = metrica.meta_valor || 1;
  metaAjustada = metaDiaria * diasUteisMes;
}
```

### 5. Modificar `KpiEditForm.tsx`

Atualizar exibição da meta de contratos para mostrar:
- Se meta percentual: `Meta: {X}% de {realizadas} = {calculado} contratos`
- Se meta fixa: `Meta: {Y}/dia × {dias} = {total} contratos`

### 6. Modificar `useFechamentoMetricas.ts`

Incluir `meta_percentual` nas operações de CRUD.

---

## Comportamento Final

### Exemplo do Julio (Nível 1):
```text
Configuração:
├─ Nível 1 Closer → meta_percentual = 30

Cálculo:
├─ R1 Realizadas: 230
├─ Meta Contratos: 30% × 230 = 69
├─ Contratos Reais: 89
├─ % Atingido: 89/69 = 129%
├─ Multiplicador: 1x (100-119%)
└─ Valor: R$ 1.050 × 1 = R$ 1.050
```

### Configuração por Nível (Sugestão):
| Nível | Meta % Contratos |
|-------|------------------|
| 1     | 30%              |
| 2     | 35%              |
| 3     | 40%              |
| 4     | 45%              |

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/migrations/xxx.sql` | Adicionar coluna `meta_percentual` |
| `src/types/sdr-fechamento.ts` | Adicionar campo no tipo `FechamentoMetricaMes` |
| `src/integrations/supabase/types.ts` | Atualizar types (automático após migration) |
| `src/components/fechamento/ActiveMetricsTab.tsx` | UI para configurar meta % |
| `src/components/fechamento/DynamicIndicatorCard.tsx` | Lógica de cálculo dinâmico |
| `src/components/sdr-fechamento/KpiEditForm.tsx` | Exibição da meta calculada |
| `src/hooks/useFechamentoMetricas.ts` | CRUD com novo campo |

---

## Validações e Edge Cases

1. **Se realizadas = 0**: Meta = 0 (evita divisão por zero)
2. **Se meta_percentual não preenchido**: Usa lógica antiga (meta_valor × diasUteis)
3. **Copiar do mês anterior**: Incluir `meta_percentual` na cópia
4. **Fallback Closers**: Usar 30% como padrão se não configurado

---

## Ordem de Implementação

1. Criar migration SQL para adicionar coluna
2. Atualizar types TypeScript
3. Modificar `ActiveMetricsTab` para UI de configuração
4. Modificar `DynamicIndicatorCard` para cálculo
5. Atualizar `KpiEditForm` para exibição
6. Testar com Julio e validar números
