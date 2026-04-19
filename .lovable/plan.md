
Objetivo: corrigir o “Aprovado 56” que ainda aparece na aba Agenda R2 > Relatório.

Diagnóstico real
- O problema agora não é “só o front” nem “só o banco” isoladamente.
- O componente `R2ContractLifecyclePanel` já tem a separação visual entre:
  - `Aprovado`
  - `Aprovado (fora do corte)`
- Porém o hook `useContractLifecycleReport` ainda chama a RPC com:
  - `p_apply_contract_cutoff: false`
- Na própria função SQL, isso força:
  - `dentro_corte = true`
- Resultado: para essa tela, todo aprovado chega como “dentro do corte”, então o split do front nunca entra em ação e o card continua em 56.

Arquivos envolvidos
- `src/hooks/useContractLifecycleReport.ts`
- `src/components/crm/R2ContractLifecyclePanel.tsx`
- `supabase/migrations/20260419222847_b3308e11-9499-4372-9d54-450c857cf23f.sql` (já confirma a regra: com `p_apply_contract_cutoff = false`, `dentro_corte` vira `true`)

O que ajustar
1. `src/hooks/useContractLifecycleReport.ts`
- Trocar a chamada da RPC para:
  - `p_apply_contract_cutoff: true`
- Manter no row os campos já adicionados:
  - `dentroCorte`
  - `effectiveContractDate`
  - `contractSource`
- Ajustar `contractPaidAt` para usar preferencialmente `r2.effective_contract_date` quando existir, evitando inconsistência visual entre data exibida e regra de corte.

2. `src/components/crm/R2ContractLifecyclePanel.tsx`
- Revisar a lógica atual só para garantir consistência após o hook passar o valor correto:
  - `Aprovado` = status aprovado + `dentroCorte = true`
  - `Aprovado (fora do corte)` = status aprovado + `dentroCorte = false`
- Manter o filtro da tabela coerente com isso.

3. Validação esperada
- Na aba Relatório:
  - o card `Aprovado` deixa de mostrar 56
  - parte desses leads migra para `Aprovado (fora do corte)`
- `Total Pagos`, `Pendentes`, `No-show`, `Reembolso` continuam iguais.
- A tabela filtrada por `Aprovado` passa a refletir a safra correta.

Por que isso explica exatamente o que você está vendo
- Se o front estivesse errado “sozinho”, a separação nem existiria no componente.
- Mas ela existe.
- O dado que alimenta essa separação está vindo inválido para essa tela, porque o hook explicitamente desliga o cutoff.
- Então o problema principal, neste ponto, é: o hook do relatório está pedindo a RPC no modo errado para essa aba.

Implementação proposta
- Fazer um ajuste pontual no hook.
- Validar se os contadores do painel mudam imediatamente sem nova migração.
- Se ainda sobrar divergência após isso, aí a próxima investigação fica restrita à montagem de `contractPaidAt`/deduplicação dessa própria tela, não mais à regra de cutoff.

Resultado esperado
- Esse é o ajuste mais provável para finalmente fazer o 56 cair na aba Relatório, porque hoje essa tela está literalmente ignorando o cutoff na chamada da RPC.
