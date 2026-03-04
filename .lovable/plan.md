

## Diagnóstico

Encontrei a causa raiz. O problema **não é** na Edge Function ou no frontend — esses estão funcionando corretamente lendo os dados do `sdr_comp_plan`. O problema é que **os próprios comp_plans de fevereiro foram criados com valores errados**.

### O que aconteceu

Quando alguém usou "Sincronizar com Catálogo" na aba Planos OTE (possivelmente com fevereiro selecionado), o sistema:
1. Encontrou o plano antigo (N1) vigente
2. Fechou o plano antigo
3. Criou um **novo plano para fevereiro usando os valores ATUAIS do catálogo** (N2)

Exemplo concreto — **Juliana Rodrigues**:
- Plano Feb 2026: N2, OTE R$ 4.500, fixo R$ 3.150 — **criado em 03/03/2026** (após a promoção)
- Plano Mar 2026: N1, OTE R$ 4.000, fixo R$ 2.800 — plano original

Ou seja, o plano de fevereiro foi criado **depois** da promoção, usando valores de N2 retroativamente. O mesmo aconteceu com Leticia Nunes, Julia Caroline, Carol Souza e Antony Elias.

### Por isso o nível e as metas estão errados

Como o comp_plan de fevereiro já tem `cargo_catalogo_id` de N2 e valores de N2, a Edge Function lê esses dados e grava `nivel_vigente = 2` corretamente — mas o dado de entrada é que está errado.

## Plano de Correção

### 1. Corrigir os comp_plans de fevereiro via SQL

Atualizar os comp_plans de fevereiro que foram criados após o mês (em março) com os valores corretos de N1:

```sql
-- Corrigir planos de fevereiro que foram criados em março com valores N2
-- para pessoas que deveriam ser N1
UPDATE sdr_comp_plan 
SET cargo_catalogo_id = 'd035345f-...N1...',
    ote_total = 4000, fixo_valor = 2800, variavel_total = 1200
WHERE vigencia_inicio = '2026-02-01' 
  AND vigencia_fim = '2026-02-28'
  AND created_at > '2026-02-28'  -- criado após fevereiro
  AND cargo_catalogo_id = '9e3d43e9-...N2...'
  AND sdr_id IN (...)  -- SDRs que eram N1 em fevereiro
```

### 2. Prevenir recontaminação na sincronização

Alterar `PlansOteTab.tsx` para:
- Exibir um **alerta** quando o mês selecionado for anterior ao mês atual
- Indicar que a sincronização usará valores **atuais** do catálogo, que podem não corresponder ao nível histórico
- Opcionalmente bloquear a sincronização para meses passados

### 3. Recalcular fevereiro

Após corrigir os comp_plans, o "Recalcular Todos" para fevereiro vai derivar corretamente N1 dos comp_plans corrigidos, e as metas/valores financeiros também serão corretos.

## Resultado Esperado

- Fevereiro mostrará N1 para quem era N1 na época
- OTE, Fixo e Variável de fevereiro refletirão os valores de N1
- O sync futuro terá proteção contra modificação retroativa

