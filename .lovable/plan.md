

## Diagnóstico da divergência R$ 2.992,50 vs R$ 1.564,50

### Causa raiz
A Edge Function `recalculate-sdr-payout` processou a Cristiane Gomes pela **branch de SDR** em vez da branch de Closer. Isso aconteceu porque, no momento da última execução, provavelmente o vínculo `employee → cargo_catalogo` ainda não existia (condição na linha 903: `isCloser && metricasAtivas.length > 0 && cargoInfo`).

A branch de SDR usa lógica completamente diferente (meta_diaria × dias_úteis, compPlan.valor_meta_rpg etc.), produzindo R$ 2.992,50 em vez do valor correto de ~R$ 1.564,50 (Contratos R$ 1.249,50 + Organização R$ 315,00).

### Evidência
Dados no banco confirmam:
- `pct_reunioes_agendadas = 306.25` → resultado típico da branch SDR (agendadas/meta_diaria), **não** da branch Closer (que armazenaria pctContratos ≈ 96.1%)
- `valor_reunioes_realizadas = 2677.5` → inclui cálculos SDR incorretos para Closer

### Correção (2 partes)

**Parte 1: Reverter os summary cards para usar cálculo local**

No `src/pages/fechamento-sdr/Detail.tsx`:
- Card "Variável": voltar a usar `calculatedVariavel.total` (valor calculado localmente)
- Card "Total Conta": voltar a usar `effectiveFixo + calculatedVariavel.total`
- Manter o badge "Recalcular" quando houver divergência com o DB, mas agora como **alerta informativo** de que o banco precisa ser atualizado

**Parte 2: Garantir consistência do useCalculatedVariavel com DynamicIndicatorCard**

No `src/hooks/useCalculatedVariavel.ts`, para métricas com `payoutPctField` (como organizacao), quando a métrica ativa tem `peso_percentual` definido, priorizar o cálculo dinâmico (`variavelTotal × peso/100`) sobre o valor individual do compPlan — mesma lógica que o DynamicIndicatorCard na sua branch de fallback.

Isso garante que o total no card "Variável" bata exatamente com a soma dos indicator cards abaixo.

### Resultado esperado
- Detail view mostra R$ 1.564,50 (calculado localmente, correto)
- Badge "Recalcular" aparece indicando que o banco (R$ 2.992,50) está desatualizado
- Ao clicar "Salvar e Recalcular", a Edge Function executa com dados atuais, usa a branch Closer correta, e atualiza o banco
- Após recálculo, lista e detalhe ficam sincronizados

### Arquivos alterados
1. `src/pages/fechamento-sdr/Detail.tsx` — reverter summary cards para valores calculados
2. `src/hooks/useCalculatedVariavel.ts` — alinhar lógica com DynamicIndicatorCard

