
Objetivo: verificar se o problema é só no front. Pela leitura do código, não é.

O que confirmei
- A tela `src/components/relatorios/CarrinhoAnalysisReportPanel.tsx`:
  - usa `data.leads` do hook
  - filtra por `l.canalEntrada`
  - renderiza o badge diretamente com `l.canalEntrada`
  - já tem estilos para `ANAMNESE`, `OUTSIDE`, `LANÇAMENTO`, `LIVE` e `A010`
- Ou seja: o front não “esconde” esses canais. Se eles não aparecem, o valor já está chegando errado do hook.

Onde está o problema real
- Em `src/hooks/useCarrinhoAnalysisReport.ts`, o campo `canalEntrada` é calculado no backend do hook.
- Hoje a prioridade final está assim:
  1. `sale_origin === 'launch'` ou produto “contrato mcf” -> `LANÇAMENTO`
  2. `classifyChannel(...)` usando tags/origin/channel do deal
  3. raw tag / origin / leadChannel
  4. `isOutside` -> `OUTSIDE`
  5. `a010Date` -> `A010`
  6. fallback final -> `LIVE`
- Portanto, se quase tudo virou `LIVE` ou `A010`, o defeito está em uma destas entradas:
  - `deal.tags`, `originName`, `leadChannel` não estão sendo resolvidos para o contato certo
  - `isOutside` está falso quando deveria ser true
  - `sale_origin` não está vindo como esperado
  - ou o fallback final está cobrindo casos demais

Diagnóstico específico do front
- Não encontrei bug de renderização no badge de Canal.
- Não encontrei filtro removendo ANAMNESE/OUTSIDE/LANÇAMENTO.
- Não encontrei mapeamento visual convertendo esses canais para `LIVE`/`A010`.

Plano de correção
1. Auditar no hook a composição de `canalEntrada` para cada lead problemático:
   - `deal?.tags`
   - `deal?.originName`
   - `deal?.leadChannel`
   - `sale_origin`
   - `isOutside`
   - `a010Date`
2. Remover o fallback excessivo para `LIVE` enquanto houver sinais incompletos, para não mascarar erro de classificação.
3. Tornar o retorno mais auditável no hook, incluindo campos brutos temporários por lead, por exemplo:
   - `rawTags`
   - `rawOriginName`
   - `rawLeadChannel`
   - `classificationReason`
4. Na UI, exibir temporariamente uma coluna/tooltip de auditoria para confirmar por que cada lead caiu em `LIVE`, `A010`, `OUTSIDE`, `LANÇAMENTO` ou `ANAMNESE`.
5. Depois de validar os casos reais, manter a lógica final e remover os campos temporários se quiser.

Conclusão
- Não parece ser “só front”.
- O front está mostrando exatamente o que recebe.
- A correção principal deve continuar em `src/hooks/useCarrinhoAnalysisReport.ts`.
- Se quiser, a próxima etapa certa é fazer uma versão auditável do hook para enxergar, lead por lead, por que Wilmar, Thalita, Patricia, Elaine, Otávio e Ariel estão sendo classificados errado.

Arquivos a revisar na implementação
- `src/hooks/useCarrinhoAnalysisReport.ts`
- opcionalmente `src/components/relatorios/CarrinhoAnalysisReportPanel.tsx` apenas para expor colunas de auditoria temporária
