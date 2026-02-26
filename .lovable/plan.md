

## Plano: Fechamento Manual via campo no RH (genérico, não exclusivo)

### Ideia
Adicionar um campo `fechamento_manual` (boolean) na tabela `employees` do RH. Quando marcado, a Edge Function `recalculate-sdr-payout` **pula o cálculo automático** para esse colaborador, permitindo que os valores do payout sejam editados diretamente na tela de detalhe. Isso pode ser aplicado a qualquer pessoa (Yanca, ou futuros casos) e removido a qualquer momento pelo RH.

### Etapas

**1. Adicionar coluna `fechamento_manual` na tabela `employees`**
- SQL: `ALTER TABLE employees ADD COLUMN fechamento_manual boolean DEFAULT false;`
- Atualizar `src/integrations/supabase/types.ts` e `src/types/hr.ts` para incluir o campo.

**2. Adicionar toggle no RH (aba Remuneração do funcionário)**
- Arquivo: `src/components/hr/tabs/EmployeeRemunerationTab.tsx`
- Adicionar um `Switch` com label "Fechamento Manual" no formulário de edição, abaixo de "Modelo de Fechamento".
- Quando ativo, exibir aviso: "O cálculo automático será desativado. Valores devem ser preenchidos manualmente no fechamento."

**3. Edge Function: pular cálculo quando `fechamento_manual = true`**
- Arquivo: `supabase/functions/recalculate-sdr-payout/index.ts`
- Na query de SDRs (linha ~449), fazer JOIN com `employees` para trazer o campo `fechamento_manual`.
- Antes do cálculo (~linha 476), verificar: se `fechamento_manual === true`, pular o recálculo automático (como faz para LOCKED/APPROVED), mantendo os valores manuais já salvos no payout.

**4. Permitir edição direta dos valores no detalhe do fechamento**
- Nos componentes de detalhe do payout (ex: `FechamentoDetail`, `KpiEditForm`), quando o payout pertence a um SDR com `fechamento_manual`, habilitar campos editáveis para `valor_reunioes_agendadas`, `valor_reunioes_realizadas`, `valor_variavel_total` etc.
- Adicionar badge "Manual" ao lado do nome para indicar visualmente.

### Resumo técnico
- 1 coluna nova no banco (`employees.fechamento_manual`)
- 3 arquivos editados (types, EmployeeRemunerationTab, Edge Function)
- 1-2 arquivos de detalhe do fechamento ajustados para edição direta
- Zero impacto em quem não tem a flag ativa

