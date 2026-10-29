# Histórico da Consulta por Sorteio da Loteria Federal

## O que já existe
Sim, existe registro. Toda vez que alguém roda a consulta, o sistema grava:
- grupo, período, número da loteria, número base e número aplicado
- cotas que bateram (match), cotas na zona de 50% e de 100%
- quem fez e quando

Até hoje: 719 consultas, de 23/02/2026 a 29/10/2026, em 39 grupos, feitas por 3 usuários.

## O que NÃO está gravado
- As ações tomadas depois do resultado (ex.: lance oferecido, cliente avisado) não ficam ligadas à consulta. Elas aparecem em outros históricos (lances e sorteios da cota), mas sem vínculo direto.

## Proposta (somente leitura)
1. Gerar uma planilha com as 719 consultas: data/hora em São Paulo, usuário, grupo, período, números e a lista de cotas em cada faixa.
2. Em outra aba, cruzar cada cota encontrada com o histórico de lances e de sorteios da mesma cota depois da data da consulta, para mostrar o que foi feito em seguida.
3. Entregar o arquivo para download. Nada é alterado no sistema.

## Detalhes técnicos
- Fonte: `consorcio_consulta_loteria` (insert em `useContemplacao.ts`).
- Cruzamento: `consorcio_lance_history` e `consorcio_sorteio_history` por cota e data posterior à consulta.
