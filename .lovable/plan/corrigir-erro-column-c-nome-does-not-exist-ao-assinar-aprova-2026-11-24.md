# Corrigir erro "column c.nome does not exist" ao assinar aprovações

## Causa (confirmada)
A função que registra a decisão (`gov_assinatura_decidir_servico`) busca o cargo do aprovador em `cargos_catalogo.nome`, mas essa coluna não existe — o nome do cargo fica em `nome_exibicao`. Por isso toda decisão (Aprovar, Devolver, Reprovar) falha antes de ser gravada, para qualquer pessoa.

## Correção
1. Migration recriando `gov_assinatura_decidir_servico` igual à atual, trocando apenas `c.nome` por `c.nome_exibicao`.
2. Procurar outras funções gov_* com o mesmo erro de coluna e corrigir na mesma migration.

## Testes das liberações
Executar em ambiente de teste, sem tocar na vaga real de Social Media:
- Criar uma requisição de teste, enviar e percorrer as 3 etapas (Responsável do setor → RH → Diretoria) chamando a função de decisão como cada aprovador.
- Conferir: só o aprovador da vez decide; Devolver/Reprovar exigem comentário; status final "Aprovada"; Devolver volta para edição e reenvio cria versão 2; Reprovar encerra.
- Conferir que a decisão grava nome, cargo, setor, horário.
- Repetir um fluxo curto para desligamento.
- Apagar os registros de teste ao final.

Observação: a assinatura pela tela com senha real de cada usuário não pode ser testada por mim; após a correção, o Matheus poderá clicar em Confirmar novamente.
