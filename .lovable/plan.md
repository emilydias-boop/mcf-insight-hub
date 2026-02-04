

# Plano: Corrigir Filtro de Métricas por Squad

## Problema Identificado

A query de busca das métricas ativas (`fechamento_metricas_mes`) **não filtra pelo squad do SDR**, retornando métricas duplicadas com pesos diferentes.

### Situação Atual

Ao buscar métricas para Cleiton Lima (squad = 'consorcio'), a query retorna:

| nome_metrica | peso_percentual | squad |
|--------------|-----------------|-------|
| agendamentos | **25%** | null (antiga) |
| realizadas | **25%** | null (antiga) |
| tentativas | 25% | null |
| no_show | 25% | null |
| agendamentos | 35% | consorcio |
| realizadas | 55% | consorcio |
| organizacao | 10% | consorcio |

O código usa `.find()` que retorna a **primeira** ocorrência, logo pega os pesos antigos de 25% em vez dos corretos 35%/55%/10%.

### Cálculo Errado (atual)
```
variavelTotal = R$ 1.350
Agendadas: 1350 × 0.25 × 1.5 = R$ 506,25  ❌
Realizadas: 1350 × 0.25 × 1.5 = R$ 506,25 ❌
```

### Cálculo Correto (esperado)
```
Agendadas: 1350 × 0.35 × 1.5 = R$ 708,75  ✓
Realizadas: 1350 × 0.55 × 1.5 = R$ 1.113,75 ✓
```

## Solução

Modificar a query de métricas para **filtrar pelo squad do SDR**. Se não houver métricas para o squad específico, fazer fallback para métricas sem squad.

### Arquivo a Modificar
`supabase/functions/recalculate-sdr-payout/index.ts` (linhas 456-470)

### Código Atual
```typescript
const { data: metricas } = await supabase
  .from('fechamento_metricas_mes')
  .select('nome_metrica, peso_percentual, meta_valor, fonte_dados')
  .eq('ano_mes', ano_mes)
  .eq('cargo_catalogo_id', employeeData.cargo_catalogo_id)
  .eq('ativo', true);
```

### Código Corrigido
```typescript
// Primeiro buscar métricas específicas do squad
let metricas: MetricaAtiva[] | null = null;

if (sdr.squad) {
  const { data: metricasSquad } = await supabase
    .from('fechamento_metricas_mes')
    .select('nome_metrica, peso_percentual, meta_valor, fonte_dados')
    .eq('ano_mes', ano_mes)
    .eq('cargo_catalogo_id', employeeData.cargo_catalogo_id)
    .eq('squad', sdr.squad)
    .eq('ativo', true);
  
  if (metricasSquad && metricasSquad.length > 0) {
    metricas = metricasSquad;
    console.log(`   📋 Métricas específicas do squad '${sdr.squad}' encontradas`);
  }
}

// Fallback: métricas genéricas (squad = null)
if (!metricas || metricas.length === 0) {
  const { data: metricasGerais } = await supabase
    .from('fechamento_metricas_mes')
    .select('nome_metrica, peso_percentual, meta_valor, fonte_dados')
    .eq('ano_mes', ano_mes)
    .eq('cargo_catalogo_id', employeeData.cargo_catalogo_id)
    .is('squad', null)
    .eq('ativo', true);
  
  if (metricasGerais && metricasGerais.length > 0) {
    metricas = metricasGerais;
    console.log(`   📋 Métricas genéricas (sem squad) encontradas`);
  }
}

if (metricas && metricas.length > 0) {
  metricasAtivas = metricas;
  console.log(`   📋 Métricas ativas para ${sdr.name}:`, 
    metricas.map(m => `${m.nome_metrica}(${m.peso_percentual}%)`).join(', '));
}
```

## Limpeza de Dados

Após a correção do código, as métricas antigas (sem squad) para o cargo SDR Consórcio devem ser removidas para evitar confusão:

```sql
-- Remover métricas antigas sem squad para SDR Consórcio 2026-01
DELETE FROM fechamento_metricas_mes 
WHERE cargo_catalogo_id = '48f6d1ce-2fc3-47a0-859a-cfed0da32715'
  AND ano_mes = '2026-01'
  AND squad IS NULL;
```

## Resultado Esperado

Após a correção:
- Agendadas: R$ 472,50 × 1.5 = **R$ 708,75**
- Realizadas: R$ 742,50 × 1.5 = **R$ 1.113,75**
- Organização: R$ 135,00 × 1.0 = **R$ 135,00**
- **Total Variável**: R$ 1.957,50
- **Total Conta**: R$ 3.150,00 + R$ 1.957,50 = **R$ 5.107,50**

