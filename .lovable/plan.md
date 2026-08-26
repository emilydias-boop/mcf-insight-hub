# Diagnóstico parcial — "Produção sem atribuição" (aba Closers)

Só leitura. Nada alterado. Onde não confirmei no código/banco, digo "não determinei" em vez de supor.

## Já confirmado

### 1) Onde a linha é renderizada
`src/components/sdr/ConsorcioCloserSummaryTable.tsx:378-399` — linha em itálico "Produção sem atribuição", exibida só quando `producaoSemAtribuicao.credito > 0`; todas as outras colunas saem como "—" e o valor cai exclusivamente na coluna de Produção Gerada (célula da linha 390-392).

O tooltip da própria linha (linha 381) declara a regra pretendida: *"Produção Gerada cujo closer não foi resolvido por nenhum caminho (criador da proposta, dono do negócio ou closer da reunião). Aparece aqui para o Total nunca esconder crédito."* Ou seja, são três tentativas de resolução em cascata — criador da proposta → dono do negócio → closer da reunião — e o resto sobra aqui.

Importante: essa linha é **diferente** da linha "Sem vendedor identificado" (mesmo arquivo, linhas 348-376), que usa `cotasSemCloser`/`creditoSemCloser` e preenche cotas/clientes/crédito. São dois resíduos distintos na mesma tabela.

**Não determinei ainda**: o arquivo:linha do hook que calcula `producaoSemAtribuicao` e o trecho exato da cascata de resolução. Preciso seguir a prop até o hook de Produção Gerada antes de afirmar o teste que cada cota falha.

### 5) Rodrigo Moreira Roberto — a correção JÁ foi aplicada
As 8 cotas do grupo 7274 (CPF 385.446.388-05) foram religadas hoje, **26/08/2026 entre 16:38:37 e 16:39:37 UTC**, uma a uma:

| cota | deal_id atual | deal anterior | ajustado em |
|---|---|---|---|
| 3397 | `5d988c40…` | `a28592fa…` | 16:38:37 |
| 3308 | `5d988c40…` | `a28592fa…` | 16:38:57 |
| 57 | `5d988c40…` | `a28592fa…` | 16:39:04 |
| 3051 | `5d988c40…` | `a28592fa…` | 16:39:12 |
| 3272 | `5d988c40…` | `a28592fa…` | 16:39:20 |
| 2210 | `5d988c40…` | `a28592fa…` | 16:39:25 |
| 678 | `5d988c40…` | `a28592fa…` | 16:39:31 |
| 140 | `5d988c40…` | `a28592fa…` | 16:39:37 |

Todas com `deal_vinculo_anterior` gravado — trilha de auditoria correta, feita pela tela. Uma observação: existe **um nono cadastro**, `7567afb4…` (grupo 7274, cota 2210, criado em 21/08), que continua com `deal_id = null` — é um cadastro duplicado da cota 2210 e não foi religado.

## Pendente nesta investigação (não determinei)

2) Se "Sem agendamento de consórcio" (`ConsorcioSdrSummaryTable.tsx:374`) usa a mesma regra e qual o valor dela hoje em agosto/2026.
3) A lista SELECT das cotas que somam os R$ 720.000, com motivo específico por cota.
4) O caminho de resolução existente por cota.
6) Se os R$ 720.000 estão dentro do Total de R$ 17.610.000 e dentro dos R$ 13.600.000 de "Consórcio Efetivado" — preciso ler a linha de Total (`ConsorcioCloserSummaryTable.tsx:418+`) e o hook antes de responder a aritmética.

Como as 8 cotas do Rodrigo acabaram de ser religadas, os números da tela mudaram depois do seu print: qualquer contagem dos R$ 720.000 precisa ser refeita agora, não comparada ao screenshot.

Diga se quer que eu continue exatamente destes quatro pontos pendentes na próxima rodada.
