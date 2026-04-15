

## Plano: Separar "Agendado" de "Realizadas" e corrigir classificação

### Problema identificado
1. **"Agendado" está dentro de "Realizadas"** — Leads com R2 status `invited` (apenas agendados, não realizaram a R2) estão sendo contados como "Realizadas". Na verdade são 22 realizadas (completed) + 15 agendados sem status + 2 com status = 37 mostrado, quando deveria ser 22 Realizadas e 17 Agendados separados.

2. **"Sem status" classifica errado um "Próxima Semana"** — No agrupamento por `r2StatusName`, leads `invited` com `r2_status_name = 'Próxima Semana'` aparecem como "Sem status" porque a lógica de children olha `r2StatusName` mas a classificação de situação já separa `proxima_semana` como situacao diferente. Na prática, o `r2StatusName` correto ("Próxima Semana") existe mas é ignorado pela classificação baseada em `r2AttendeeStatus`.

### Dados reais da safra atual
- `completed` (R2 feita): 22 → **Realizadas** (filhos: 18 Aprovado, 2 Reprovado, 1 Próxima Semana, 1 Desistente)
- `invited` (R2 marcada): 17 → **Agendado** (filhos: 1 Aprovado, 1 Próxima Semana, 15 Sem status)
- `no_show`: 6 → **No-show** (sem mudança, mas antes eram 2 — os 4 extras vêm do cross-pipeline fix)
- `pre_scheduled`: 7 → **Pré-agendado**
- Sem R2: restante → **Pendente**

### Correções

**Arquivo 1: `src/hooks/useContractLifecycleReport.ts`** — `classifySituacao`

Reorganizar a prioridade de classificação:
- `realizada` = apenas `r2AttendeeStatus` in (`completed`, `contract_paid`)
- `agendado` = `r2AttendeeStatus` in (`invited`, `scheduled`) E r2Date < fridayCutoff
- `proxima_semana` = `r2AttendeeStatus` in (`invited`, `scheduled`) E r2Date >= fridayCutoff
- Remover a mistura — `agendado` e `proxima_semana` NÃO são "realizadas"

(A lógica atual já faz isso corretamente na classificação individual — o problema está no agrupamento do painel)

**Arquivo 2: `src/components/crm/R2ContractLifecyclePanel.tsx`** — KPIs e agrupamento

1. **Separar "Agendado" como KPI pai próprio** (não mais filho de Realizadas):
   - `PARENT_SITUACOES.realizadas` → apenas `['realizada']`
   - Novo: `PARENT_SITUACOES.agendados` → `['agendado', 'proxima_semana']`
   - Adicionar "Agendados" ao `EXPANDABLE_PARENTS`

2. **Atualizar KPIs**:
   - `realizadas` = count de `situacao === 'realizada'` apenas
   - `agendados` = count de `situacao in ['agendado', 'proxima_semana']`

3. **Children de "Realizadas"** → agrupar por `r2StatusName` (Aprovado, Reprovado, etc.) — apenas R2s completadas
4. **Children de "Agendados"** → agrupar por `r2StatusName` (Sem status, Próxima Semana, Aprovado)

5. **Grid**: Mudar de 6 para 7 colunas para acomodar o novo KPI, ou reorganizar em 2 linhas

### Resultado esperado
```text
Total Pagos: 59
Realizadas: ~22  (só completed/contract_paid)
  └─ Aprovado: 18, Reprovado: 2, Próxima Semana: 1, Desistente: 1
Agendado: ~17   (invited/scheduled — R2 marcada mas não feita)
  └─ Sem status: 15, Próxima Semana: 1, Aprovado: 1
Pré-agendado: 7
Pendentes: ~10
No-show: ~6     (inclui cross-pipeline)
Reembolso: 3
```

### Seção técnica

```ts
// PARENT_SITUACOES atualizado
const PARENT_SITUACOES = {
  realizadas: ['realizada'],           // ANTES: ['realizada', 'agendado', 'proxima_semana']
  agendados: ['agendado', 'proxima_semana'],  // NOVO
  pre_agendado: ['pre_agendado'],
  pendentes: ['pendente'],
  noShow: ['no_show'],
  reembolso: ['reembolso'],
};

const EXPANDABLE_PARENTS = ['realizadas', 'agendados', 'pendentes'];

// KPIs
kpis.realizadas = rows.filter(r => r.situacao === 'realizada').length;
kpis.agendados = rows.filter(r => ['agendado', 'proxima_semana'].includes(r.situacao)).length;

// Children de "agendados" — mesma lógica de realizadasChildren mas para agendados
const agendadosChildren = useMemo(() => {
  const map = new Map();
  rows.filter(r => ['agendado', 'proxima_semana'].includes(r.situacao))
    .forEach(r => {
      const key = r.r2StatusName || 'Sem status';
      // ...
    });
  return Array.from(map.entries());
}, [rows]);
```

Arquivos alterados: `R2ContractLifecyclePanel.tsx` (UI) e possivelmente leve ajuste em `useContractLifecycleReport.ts` (a classificação individual já está correta, o problema é o agrupamento).

