

# Corrigir Planos OTE para Closers Consorcio

## Problemas raiz

1. **Squad mismatch no dialog**: `EditIndividualPlanDialog` recebe `squad = "BU - Consórcio"` (departamento) mas verifica `squad === 'consorcio'` → campos de meta comissão nunca aparecem
2. **saveCompPlan ignora novos campos**: A mutation não salva `meta_comissao_consorcio` / `meta_comissao_holding`
3. **comp_plan não carrega novos campos**: O mapeamento em `employeesWithPlans` não inclui as colunas adicionadas na migration
4. **currentValues não passa os valores**: O dialog não recebe `meta_comissao_consorcio` / `meta_comissao_holding` do plano existente
5. **Tabela não diferencia SDR de Closer**: Todos aparecem com coluna "Meta/Dia" que é irrelevante para Closers

## Solução

### Arquivo 1: `src/components/fechamento/PlansOteTab.tsx`

**Corrigir squad passado ao dialog (linha 707):**
- Mudar de `squad={editDialog.employee.departamento}` para converter o departamento para o valor correto: `"BU - Consórcio"` → `"consorcio"`

**Incluir novos campos no comp_plan (linhas 311-321):**
- Adicionar `meta_comissao_consorcio` e `meta_comissao_holding` ao mapeamento do plano

**Incluir novos campos no currentValues (linhas 709-718):**
- Passar `meta_comissao_consorcio` e `meta_comissao_holding` do comp_plan para o dialog

**Persistir novos campos no saveCompPlan (linhas 190-211):**
- Adicionar `meta_comissao_consorcio` e `meta_comissao_holding` ao `planData`

**Diferenciar Closers na tabela:**
- Buscar `role_type` do SDR vinculado
- Para Closers consórcio, mostrar "Meta Comissão" em vez de "Meta/Dia"
- Ou simplesmente adaptar a coluna para mostrar o valor relevante por tipo

### Arquivo 2: `src/components/fechamento/EditIndividualPlanDialog.tsx`

**Corrigir condição do squad (linha 214):**
- Atualmente: `squad === 'consorcio'`
- Adicionar fallback: `squad === 'consorcio' || squad === 'BU - Consórcio'`
- Ou melhor: normalizar no componente pai (solução no PlansOteTab)

**Esconder "Meta Diária" para Closers:**
- Receber prop indicando se é closer
- Se for closer consórcio, esconder campo "Meta Diária (reuniões)" e dar destaque aos campos de meta comissão

### Arquivo 3: `src/components/fechamento/PlansOteTab.tsx` (interface `EmployeeWithPlan`)

- Adicionar `meta_comissao_consorcio` e `meta_comissao_holding` na interface `comp_plan`
- Adicionar `role_type` para distinguir SDR de Closer na tabela

## Resultado esperado
- João Pedro (Closer Consórcio): dialog mostra campos de Meta Comissão Consórcio/Holding, sem "Meta Diária"
- Campos de meta comissão salvam corretamente no `sdr_comp_plan`
- Tabela mostra meta comissão para Closers e meta diária para SDRs
- Valores persistem e são carregados corretamente ao reabrir o dialog

