
## Diagnóstico

Eu sei qual é o problema? Sim.

Não existe uma única contagem de “Aprovados” hoje; o front está mostrando números diferentes porque cada área usa uma regra diferente:

- `26` no card KPI do Carrinho: `src/hooks/useR2CarrinhoKPIs.ts` ainda tem lógica própria de merge/deduplicação e pode deixar um registro regular não-aprovado ocupar o `deal_id` antes do aprovado.
- `27` na badge da aba **Aprovados**: vem de `useR2CarrinhoData('aprovados')` e hoje é a fonte mais próxima do “aprovado do carrinho”.
- `26 em acompanhamento` dentro da aba **Aprovados**: não é total de aprovados; é **aprovados menos vendidos**. Então esse número nunca deveria ser obrigado a bater com o total.
- `25 R2s filtradas` em **Todas R2s** com filtro “Aprovado”: essa tela parte do universo `agendadas`, que já exclui `cancelled/rescheduled` antes de aplicar o filtro de status.
- `30 Aprovado` no **Lifecycle**: esse número não é “total aprovado do carrinho”; ele está vindo do agrupamento filho de **Realizadas**, em um dataset diferente (`useContractLifecycleReport`).

Ou seja: não parece haver uma “trava” visual no front. O problema é que hoje existem 4 contagens diferentes sendo exibidas como se fossem a mesma métrica.

## Plano

### 1. Criar uma regra canônica de “Aprovados”
Centralizar a lógica de “aprovado do carrinho” em uma única fonte compartilhada.

Regra única:
- mesma boundary do carrinho
- mesma deduplicação por lead/deal
- mesma prioridade para encaixados
- mesmo tratamento de `carrinho_week_start`

Vou usar como referência o comportamento que hoje gera `27`, já que esse foi o critério validado por você para encaixados.

### 2. Corrigir o KPI do Carrinho
Arquivo:
- `src/hooks/useR2CarrinhoKPIs.ts`

Ajuste:
- filtrar **regulares aprovados antes do merge/dedup**, não só os encaixados.
- hoje ainda existe espaço para um registro não-aprovado “ganhar” o `deal_id` e derrubar 1 aprovado.

Resultado esperado:
- o KPI sobe de `26` para `27`.

### 3. Corrigir a aba Aprovados para separar “total” de “em acompanhamento”
Arquivo:
- `src/components/crm/R2AprovadosList.tsx`

Ajuste:
- deixar explícito no cabeçalho:
  - **Total aprovados** = fonte canônica
  - **Em acompanhamento** = aprovados menos vendidos
- hoje o `26` dessa área confunde porque visualmente parece “total aprovados”, mas é outra fórmula.

Também vou alinhar o cálculo de vendidos:
- `R2AprovadosList` hoje chama `useR2CarrinhoVendas(weekStart, weekEnd)` sem `config/previousConfig`
- a página principal usa a versão com config
- isso pode gerar exclusão/contagem diferente da própria tela

### 4. Alinhar “Todas R2s” quando o filtro for Aprovado
Arquivos:
- `src/pages/crm/R2Carrinho.tsx`
- `src/components/crm/R2AgendadasList.tsx`

Ajuste:
- quando o filtro selecionado for “Aprovado”, essa visualização deve usar a **mesma fonte canônica dos aprovados**, e não o universo de `agendadas`.
- hoje ela cai para `25` porque herda a exclusão de `cancelled/rescheduled` antes do filtro.

Resultado esperado:
- “Todas R2s” filtrado por Aprovado passa a mostrar o mesmo número da aba Aprovados.

### 5. Corrigir o Lifecycle
Arquivos:
- `src/hooks/useContractLifecycleReport.ts`
- `src/components/crm/R2ContractLifecyclePanel.tsx`

Ajuste:
- parar de usar o filho de **Realizadas** como se fosse “total aprovado”.
- expor um KPI/contador explícito de **Aprovados** baseado na mesma fonte canônica do Carrinho.
- manter o filtro de `carrinho_week_start`, mas trocar a origem do número exibido como “Aprovado”.

Resultado esperado:
- o Lifecycle deixa de mostrar `30` como se fosse o mesmo “Aprovado” do Carrinho e passa a bater com o total canônico.

## Resultado esperado final

Depois da implementação:

- KPI Carrinho = `27`
- Badge da aba Aprovados = `27`
- Todas R2s filtrado por Aprovado = `27`
- Lifecycle Aprovados = `27`

E o número **“Em acompanhamento”** pode continuar diferente sem parecer erro, porque ficará claramente identificado como uma métrica secundária.

## Arquivos envolvidos

- `src/hooks/useR2CarrinhoKPIs.ts`
- `src/hooks/useR2CarrinhoData.ts` ou um helper compartilhado novo para a regra canônica
- `src/pages/crm/R2Carrinho.tsx`
- `src/components/crm/R2AprovadosList.tsx`
- `src/components/crm/R2AgendadasList.tsx`
- `src/hooks/useR2CarrinhoVendas.ts`
- `src/hooks/useContractLifecycleReport.ts`
- `src/components/crm/R2ContractLifecyclePanel.tsx`
