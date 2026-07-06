## Contexto atual

Os tetos/percentuais dos KPIs mostrados no print do "Editar KPIs" vêm de três lugares:

| KPI | Fonte de dados | Hoje editável na UI? |
|---|---|---|
| **Teto de No-Show** (ex.: 40%) | `sdr_comp_plan.meta_no_show_pct` | **Não** — hardcoded `30` no salvamento do plano |
| **Reuniões Realizadas %** (ex.: 60% das agendadas) | `sdr_comp_plan.meta_reunioes_realizadas / meta_reunioes_agendadas` | **Não** — hardcoded `0.7` no salvamento |
| **Intermediações de Contrato %** (ex.: 30% das realizadas) | `fechamento_metrica_mes.meta_percentual` para a métrica `contratos` | **Sim** — já editável na aba **Métricas Ativas** |

## O que será feito

1. Adicionar na tela **Planos OTE > Editar Plano Individual** campos editáveis para:
   - **Teto de No-Show** (%)
   - **Percentual de Reuniões Realizadas** (% sobre agendadas)
   - Exibir o **Percentual de Intermediações de Contrato** com link direto para a aba **Métricas Ativas** (por ser configuração por cargo/squad, não por SDR)

2. Ajustar a mutation `saveCompPlan` em `PlansOteTab.tsx` para salvar os novos valores no `sdr_comp_plan` em vez dos hardcodeds (`meta_no_show_pct: 30` e `meta_reunioes_realizadas: meta_diaria * 19 * 0.7`).

3. Atualizar `EditIndividualPlanDialog.tsx` para receber, exibir e devolver os novos valores no formulário.

4. Adicionar tooltips/explicações nos campos para deixar claro que eles impactam os cálculos de performance e multiplicador no fechamento.

5. Garantir que, quando um plano individual é criado a partir de um plano anterior (mês passado), os novos campos sejam copiados corretamente.

## Arquivos envolvidos

- `src/components/fechamento/EditIndividualPlanDialog.tsx`
- `src/components/fechamento/PlansOteTab.tsx`
- `src/types/sdr-fechamento.ts` (se necessário ajustar tipos de `PlanValues`)
- `src/lib/sdrMetaPercentuais.ts` (não precisa mudar — já lê do comp plan)

## Fora do escopo

- Não alterar o cálculo da performance inversa de No-Show nem as faixas de multiplicador.
- Não alterar o funcionamento da aba **Métricas Ativas** — apenas melhorar a navegabilidade para ela.
- Não criar novas colunas no banco — os campos `meta_no_show_pct`, `meta_reunioes_realizadas` e `meta_reunioes_agendadas` já existem em `sdr_comp_plan`.

## Resultado esperado

A tela de Planos OTE passa a permitir que gestores configurem o teto de No-Show e o percentual de Reuniões Realizadas por SDR/mês, e a tela de Editar KPIs reflete esses valores automaticamente sem precisar de ajustes manuais no banco.