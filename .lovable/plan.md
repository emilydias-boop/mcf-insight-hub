
Objetivo: travar o Fechamento Equipe ao contexto da BU e impedir exibição de pessoas de outras BUs.

1) Travar contexto da BU na rota do menu
- Arquivo: `src/components/layout/AppSidebar.tsx`
- Alterar link de “Fechamento Equipe” para carregar BU explícita:
  - de: `/fechamento-sdr`
  - para: `/fechamento-sdr?bu=incorporador`

2) Remover comportamento global (“Todas BUs”) nesta tela
- Arquivo: `src/pages/fechamento-sdr/Index.tsx`
- Definir `effectiveBu` com prioridade:
  - `searchParams.get("bu")` válido
  - senão `useActiveBU()` válido
  - senão fallback fixo `incorporador` (para admin sem squad)
- Usar `effectiveBu` sempre em `useSdrPayouts(..., { squad: effectiveBu, ... })`.
- Remover opção “Todas BUs” e transformar o filtro BU em valor fixo (badge/texto), mantendo só busca + cargo.
- Ajustar “Limpar filtros” para não voltar BU para `all`.
- Preservar `bu` ao trocar mês (`setSearchParams`) para não perder o lock.

3) Endurecer filtro de BU no hook (normalização)
- Arquivo: `src/hooks/useSdrFechamento.ts`
- Substituir comparação textual rígida de departamento por normalização para chave canônica de BU:
  - aceitar variações (`BU - Incorporador 50K`, `BU - Incorporador MCF`, `BU - Consorcio/Consórcio`, etc.)
- Filtrar por BU canônica resolvida em cascata:
  - `departamento_vigente` → `employee.departamento` → `sdr.squad`
- Resultado: mesmo com variação de nomenclatura, só entra registro da BU alvo.

4) Preservar contexto BU nos fluxos de navegação
- Arquivos:
  - `src/pages/fechamento-sdr/Index.tsx`
  - `src/pages/fechamento-sdr/Detail.tsx`
- Incluir `bu` no navigate para detalhe e no retorno (botão Voltar), mantendo a tela sempre no mesmo escopo da BU.

5) Retirar o que não é necessário para este fluxo
- Remover da tela `/fechamento-sdr` a capacidade de visão multi-BU (opção “Todas BUs”), pois conflita com o requisito de isolamento por BU.
- Se precisar de visão global depois, criar rota separada de gestão global (não nesta tela de BU).

Validação (passo a passo)
- Logar com usuário admin sem squad e abrir via menu “BU - Incorporador MCF > Fechamento Equipe”.
- Confirmar que:
  - filtro BU não permite “Todas BUs”,
  - tabela mostra somente pessoas da BU incorporador,
  - troca de mês mantém BU travada,
  - entrar no detalhe e voltar mantém BU travada.
- Testar também com usuário multi-BU para garantir que o lock da URL prevalece.
