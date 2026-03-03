

## Problema

O `sdr_comp_plan` usa um modelo de **vigência por faixa de data** (`vigencia_inicio` / `vigencia_fim`). Quando o usuário edita o plano para **março**, a mutation `saveCompPlan`:

1. Busca um plano existente com `vigencia_inicio <= '2026-03-01'` e `vigencia_fim IS NULL`
2. **Encontra o plano de fevereiro** (que tem `vigencia_inicio = '2026-02-01'` e `vigencia_fim = NULL`)
3. **Sobrescreve esse mesmo registro**, mudando `vigencia_inicio` para `'2026-03-01'` e atualizando todos os valores

Resultado: fevereiro perde seus dados originais e passa a ter os valores de março. SDRs que foram promovidos entre meses perdem o histórico do nível anterior.

O mesmo problema ocorre na `syncWithCatalog` — atualiza o `comp_plan.id` encontrado sem considerar que ele pode cobrir outros meses.

## Correção

### 1. Lógica de save com preservação de histórico (`saveCompPlan`)

Quando já existe um plano vigente e ele foi criado **antes** do mês selecionado:

- **Fechar** o plano antigo: `UPDATE vigencia_fim = último dia do mês anterior`
- **Criar** um novo registro com `vigencia_inicio = primeiro dia do mês selecionado` e `vigencia_fim = NULL`

Quando o plano vigente tem `vigencia_inicio` **igual** ao mês selecionado:
- **Atualizar** normalmente (é o plano do próprio mês)

```text
Antes (plano único):
  vigencia_inicio: 2026-02-01, vigencia_fim: NULL, ote: 4000

Após editar março com ote=4500:
  Plano 1: vigencia_inicio: 2026-02-01, vigencia_fim: 2026-02-28, ote: 4000  ← preservado
  Plano 2: vigencia_inicio: 2026-03-01, vigencia_fim: NULL, ote: 4500        ← novo
```

### 2. Ajustar a query de leitura (`compPlans` query)

A query atual já busca planos vigentes para o mês selecionado. Quando houver múltiplos planos para o mesmo SDR (por ex. um fechando em fev e outro abrindo em mar), deve pegar o **mais recente** cuja vigência cubra o mês. Adicionar `.order('vigencia_inicio', { ascending: false })` e no `useMemo` pegar o primeiro match por `sdr_id`.

### 3. Ajustar `syncWithCatalog`

A sincronização deve aplicar a mesma lógica: se o plano vigente cobre meses anteriores, fechar o antigo e criar novo para o mês atual. Não sobrescrever diretamente.

### Arquivos modificados

- `src/components/fechamento/PlansOteTab.tsx` — mutations `saveCompPlan` e `syncWithCatalog`, query de leitura

