

## Aba "Acumulados" + Alerta no Carrinho R2

### Contexto
Leads marcados como "Próxima Semana" ficam na aba "Fora do Carrinho" da semana anterior e não há mecanismo para localizá-los na semana seguinte. O mesmo ocorre com contratos acumulados de semanas anteriores que não entraram no carrinho.

### O que será feito

#### 1. Nova aba "Acumulados" no Carrinho R2
Uma aba entre "Fora do Carrinho" e "Aprovados" que lista automaticamente:
- **Leads "Próxima Semana"** de semanas anteriores (busca nas safras anteriores leads com status R2 "Próxima Semana" que ainda não foram reagendados)
- **Contratos pendentes** de semanas anteriores que não tiveram R2 agendada/aprovada (acúmulo)

A aba terá um badge com a contagem total para chamar atenção.

#### 2. Alerta visual no topo
Um banner/card de alerta amarelo no topo da página (abaixo dos KPIs) que aparece quando existem acumulados, com texto como:
> "⚠️ X leads acumulados de semanas anteriores precisam de atenção (Y próxima semana + Z sem R2)"

Com link direto para a aba Acumulados.

### Implementação

#### Hook: `useR2AccumulatedLeads.ts` (novo)
- Busca contratos das últimas 4 safras anteriores à atual
- Para cada contrato, verifica se o lead:
  - Tem status R2 "Próxima Semana" (fonte: `r2_status_options`)
  - Ou não tem nenhuma R2 aprovada/agendada após o contrato
- Retorna lista tipada com origem (`proxima_semana` ou `sem_r2`) e dados do lead

#### Componente: `R2AccumulatedList.tsx` (novo)
- Tabela similar à R2ForaDoCarrinhoList
- Filtro por tipo (Próxima Semana / Sem R2)
- Colunas: Nome, Telefone, Semana Original, Closer R1, Tipo, Ações

#### Componente: `R2AccumulatedAlert.tsx` (novo)
- Banner amarelo/laranja com contagem e botão para ir à aba

#### Atualizar: `R2Carrinho.tsx`
- Adicionar nova aba "Acumulados" com badge de contagem
- Adicionar alerta condicional acima das tabs
- Integrar o novo hook

### Arquivos
1. `src/hooks/useR2AccumulatedLeads.ts` — novo hook
2. `src/components/crm/R2AccumulatedList.tsx` — nova lista
3. `src/components/crm/R2AccumulatedAlert.tsx` — alerta visual
4. `src/pages/crm/R2Carrinho.tsx` — integrar aba + alerta

