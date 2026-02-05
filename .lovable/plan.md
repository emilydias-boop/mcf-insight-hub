
# Plano de Correção: Fechamento Closer - Meta % e Valores

## ✅ CONCLUÍDO

### Correções Implementadas

1. **Edge Function atualizada** (`supabase/functions/recalculate-sdr-payout/index.ts`)
   - Adicionado `meta_percentual` na interface `MetricaAtiva`
   - Query de métricas agora busca `meta_percentual`
   - Lógica específica para Closers com métricas dinâmicas
   - Meta de contratos calculada como `(Realizadas × meta_percentual) / 100`
   - Usa `variavel_valor` do `cargo_catalogo` ao invés de fallback

2. **KpiEditForm atualizado** (`src/components/sdr-fechamento/KpiEditForm.tsx`)
   - Nova prop `metaContratosPercentual`
   - Exibe meta como "X% de Y Realizadas = Z" quando configurado
   - Fallback para exibição anterior quando não há meta percentual

3. **Detail.tsx atualizado** (`src/pages/fechamento-sdr/Detail.tsx`)
   - Busca métricas ativas para obter `meta_percentual`
   - Passa prop para KpiEditForm

---

## Próximos Passos para o Usuário

### Configurar Meta Percentual

1. Ir em **Configurações > Métricas Ativas**
2. Selecionar **Closer Inside N1**
3. Métrica **Contratos Pagos** → definir **Meta % = 30**
4. Salvar

Após configurar, recalcular o fechamento do Closer para ver os valores corretos.

---

## Fluxo de Cálculo Corrigido

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

Resultado Esperado:
├─ Variável Total: ~R$ 1.050 (depende de organização)
├─ Fixo: R$ 4.900
└─ Total Conta: ~R$ 5.950
```
