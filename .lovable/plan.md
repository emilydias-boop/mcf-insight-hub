
# Plano de Correção: Fechamento Closer - Meta % e Valores

## Problemas Identificados

### 1. Meta de Contratos (20 ao invés de 69)
- **Causa**: O campo `meta_percentual` está NULL na tabela `fechamento_metricas_mes`
- **Verificação**: Query mostra `meta_percentual: <nil>` para Closer Inside N1
- **Solução**: Preencher `meta_percentual = 30` na UI de configuração + garantir que o hook retorna esse campo

### 2. Variável R$ 150 (deveria ser ~R$ 2.100)
- **Causa**: A Edge Function não está usando o `variavel_valor` do `cargo_catalogo` corretamente para Closers
- **Valor correto**: cargo_catalogo mostra `variavel_valor = 2100`
- **Comportamento atual**: Calcula apenas `valor_reunioes_realizadas` que resultou em R$ 150
- **Solução**: Corrigir Edge Function para usar pesos das métricas ativas × variável do cargo para Closers

### 3. iFood Ultrameta = R$ 0
- **Causa**: A lógica exige média >= 100% para dar Ultrameta
- **Comportamento esperado**: Closers Inside deveriam ter iFood Ultrameta quando atingem meta de contratos
- **Solução**: Revisar regra de iFood Ultrameta para Closers (talvez baseada em contratos ao invés de média geral)

### 4. Hook não retorna `meta_percentual`
- **Causa**: Query SQL seleciona `*` mas o tipo TypeScript não inclui `meta_percentual`
- **Solução**: Garantir que o tipo `FechamentoMetricaMes` inclui `meta_percentual`

---

## Correções Técnicas

### A. Garantir `meta_percentual` no fluxo de dados

**Arquivo**: `src/hooks/useActiveMetricsForSdr.ts`
- Query já usa `SELECT *`, então o campo vem do DB
- Verificar se `ActiveMetric` herda corretamente de `FechamentoMetricaMes`

**Arquivo**: `src/types/sdr-fechamento.ts`
- Confirmar que `FechamentoMetricaMes` tem `meta_percentual?: number | null`

### B. Corrigir Edge Function para Closers

**Arquivo**: `supabase/functions/recalculate-sdr-payout/index.ts`

Problemas atuais:
1. Não busca `meta_percentual` das métricas ativas
2. Não calcula meta de contratos como % das realizadas
3. Usa pesos fixos que não se aplicam a Closers

Correções:
```typescript
// Interface MetricaAtiva precisa incluir meta_percentual
interface MetricaAtiva {
  nome_metrica: string;
  peso_percentual: number;
  meta_valor: number | null;
  meta_percentual: number | null;  // ADICIONAR
  fonte_dados: string | null;
}

// Na query de métricas ativas, adicionar meta_percentual
.select('nome_metrica, peso_percentual, meta_valor, meta_percentual, fonte_dados')
```

### C. Calcular métricas dinâmicas para Closers na Edge Function

Para Closers com métricas ativas (contratos, organizacao):
```typescript
// Calcular variável total baseado no cargo_catalogo
const variavelTotal = cargo?.variavel_valor || fallbackDefault.variavel_total;

// Para cada métrica ativa, calcular:
// - contratos: meta = realizadas × meta_percentual%
// - organizacao: meta = 100% fixa

// Calcular pct_contratos:
const metricaContratos = metricasAtivas?.find(m => m.nome_metrica === 'contratos');
if (metricaContratos?.meta_percentual) {
  const metaContratos = Math.round(reunioesRealizadas * metricaContratos.meta_percentual / 100);
  const pctContratos = metaContratos > 0 ? (contratosPagos / metaContratos) * 100 : 0;
  const multContratos = getMultiplier(pctContratos);
  const valorContratos = (variavelTotal * metricaContratos.peso_percentual / 100) * multContratos;
}
```

### D. Configurar meta_percentual para Closer Inside N1

Na UI de configuração (`ActiveMetricsTab`):
- Usuário precisa ir em Configurações > Métricas Ativas
- Selecionar cargo "Closer Inside N1"
- Métrica "Contratos Pagos" → definir Meta % = 30

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/recalculate-sdr-payout/index.ts` | Buscar `meta_percentual`, calcular métricas de Closer corretamente |
| `src/components/sdr-fechamento/KpiEditForm.tsx` | Exibir meta como % das Realizadas quando configurado |
| `src/hooks/useActiveMetricsForSdr.ts` | Verificar que `meta_percentual` está incluído |
| `src/types/sdr-fechamento.ts` | Confirmar tipo inclui `meta_percentual` |

---

## Fluxo de Cálculo Corrigido para Closer

```text
Entrada:
├─ Realizadas: 230 (da Agenda)
├─ Contratos Pagos: 89 (da Agenda)
├─ Organização: 0% (pendente manual)
├─ Variável Total: R$ 2.100 (do cargo_catalogo)
└─ Métricas Ativas: contratos(50%, meta_percentual=30), organizacao(50%)

Cálculo Contratos:
├─ Meta: 30% × 230 = 69
├─ Realizado: 89
├─ %: 89/69 = 129%
├─ Multiplicador: 1x (100-119%)
├─ Valor Base: R$ 2.100 × 50% = R$ 1.050
└─ Valor Final: R$ 1.050 × 1 = R$ 1.050

Cálculo Organização:
├─ Meta: 100%
├─ Realizado: 0% (pendente)
├─ %: 0%
├─ Multiplicador: 0x
├─ Valor Base: R$ 2.100 × 50% = R$ 1.050
└─ Valor Final: R$ 1.050 × 0 = R$ 0

Resultado:
├─ Variável Total: R$ 1.050 + R$ 0 = R$ 1.050
├─ Fixo: R$ 4.900
└─ Total Conta: R$ 5.950
```

---

## Ordem de Implementação

1. **Atualizar Edge Function** - Corrigir cálculo para Closers com métricas dinâmicas
2. **Verificar tipos** - Garantir `meta_percentual` está no fluxo
3. **Corrigir KpiEditForm** - Exibir meta como % quando aplicável
4. **Configurar dados** - Usuário precisa preencher meta_percentual = 30 para Closer Inside N1
