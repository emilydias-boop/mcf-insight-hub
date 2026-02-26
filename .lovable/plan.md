

## Auditoria: Configurações de Fechamento

### Problemas encontrados

**1. ~400 linhas de dead code no arquivo principal**
O `Configuracoes.tsx` (789 linhas) contém 4 componentes de dialog legados que **nunca são renderizados**: `EditSdrDialog`, `EditCompPlanDialog`, `SdrFormDialog`, `CompPlanFormDialog` (linhas 78-561). Todos os hooks associados (`useSdrsAll`, `useAllCompPlans`, `useCreateSdr`, `useApproveSdr`, `useCreateCompPlan`, `useApproveCompPlan`, `useDeleteCompPlan`, `useUsers`, `useUpdateSdr`, `useUpdateCompPlan`) e handlers (`handleApproveSdr`, `handleApproveCompPlan`, `handleToggleActive`, `handleDeleteCompPlan`) também são dead code — instanciados mas jamais referenciados no JSX.

**2. Aba "Equipe" não filtra por BU da rota**
A tela é acessada dentro de uma BU específica (ex: Incorporador MCF), mas a aba Equipe permite "Todas as BUs", mostrando pessoas de Consórcio e Crédito misturadas. Deveria travar na BU da rota, igual fizemos no Fechamento Equipe.

**3. Aba "Equipe" é redundante com o RH**
A aba apenas lista employees do RH com um botão "Gerenciar no RH". Não permite edição — é puramente uma visualização duplicada. O único valor agregado seria se filtrasse apenas quem participa do fechamento daquela BU.

**4. Planos OTE e Métricas Ativas também não filtram por BU da rota**
Ambos permitem "Todas" as BUs, quebrando o isolamento quando acessado dentro de uma BU.

**5. Metas Equipe: BU padrão hardcoded**
O `TeamMonthlyGoalsTab` sempre inicia com `selectedBu='incorporador'`, independente da BU de onde o usuário acessa.

**6. `SdrConfigTab` (Consórcio) gerencia tabela `sdr` legada**
Usado apenas em `FechamentoConfig.tsx` do Consórcio. Duplica cadastro que deveria vir do RH + employees.

### Plano de ação

**Etapa 1: Remover dead code do Configuracoes.tsx**
- Deletar os 4 componentes de dialog legados (linhas 67-561)
- Remover imports e hooks não utilizados (`useSdrsAll`, `useAllCompPlans`, `useCreateSdr`, etc.)
- Remover handlers mortos (`handleApproveSdr`, `handleApproveCompPlan`, `handleToggleActive`, `handleDeleteCompPlan`)
- Resultado: arquivo reduzido de ~789 para ~200 linhas

**Etapa 2: Travar BU pelo contexto da URL**
- Ler `searchParams.get('bu')` ou usar `useActiveBU()` como fallback
- Passar `effectiveBu` como prop para `PlansOteTab`, `ActiveMetricsTab`, `TeamMonthlyGoalsTab` (via `defaultBU` + `lockBU`)
- Na aba Equipe, remover o dropdown "Todas as BUs" e filtrar direto pela BU travada
- Badge estática mostrando a BU ativa

**Etapa 3: Ajustar TeamMonthlyGoalsTab**
- Aceitar props `defaultBU` e `lockBU` (igual PlansOteTab e ActiveMetricsTab já fazem)
- Quando `lockBU=true`, esconder seletor de BU e usar `defaultBU`

**Etapa 4: Atualizar link do sidebar**
- Garantir que o link para Configurações de Fechamento inclua `?bu=incorporador` (ou BU correspondente) no `AppSidebar.tsx`

