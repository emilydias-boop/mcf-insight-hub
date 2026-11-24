# Corrigir assinatura das aprovações e documentar o fluxo de liberação

## 1. Corrigir o erro "column c.nome does not exist" (confirmado)
A função que grava a decisão do aprovador lê o cargo numa coluna que não existe; o nome correto é o nome de exibição do cargo. Toda decisão (Aprovar, Devolver, Reprovar) falha hoje. Só essa função tem o problema (busca feita em todas as funções que leem cargos).
- Recriar a função idêntica, trocando apenas essa coluna.

## 2. Testar as liberações
Com uma requisição de teste (sem tocar na vaga real de Social Media):
- Percorrer as 3 etapas (Responsável do setor → RH → Diretoria); conferir ordem, que só o aprovador da vez decide, status final "Aprovada".
- Devolver exige comentário, volta para edição e reenvio cria versão 2; Reprovar encerra.
- Conferir nome, cargo, setor e horário gravados. Repetir fluxo curto de desligamento.
- Apagar os registros de teste.

## 3. PDF "Fluxo de liberação das requisições de contratação" (padrão MCF)
Documento I.T. no mesmo padrão visual dos PDFs MCF anteriores, com:
- Visão geral e diagrama do fluxo (Rascunho → Em aprovação → Aprovada / Reprovada / Devolvida).
- Passo a passo do solicitante: onde ir (RH → Requisições de contratação), campos obrigatórios (setor, centro de custo, cargo, título, descrição, local, data de início), envio para aprovação.
- Como os atores previstos são definidos (regras de alçada por setor) e a ordem das etapas.
- Passo a passo de cada aprovador: menu pessoal → Minhas aprovações → abrir requisição → Decidir → Aprovar e assinar / Devolver / Reprovar, com comentário, confirmação e senha ou conta Google.
- Prazos por etapa, devolução e nova versão, página de Verificação e exportação.
- Perguntas frequentes (ex.: campo vazio, não vejo a aprovação → sair e entrar de novo).
Revisão visual de todas as páginas antes de entregar.
