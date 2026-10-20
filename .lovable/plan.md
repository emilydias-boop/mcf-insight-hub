# Relatório diário por BU de 19/10 (somente leitura)

## O que será feito
1. Rodar a consulta `select * from public.relatorio_diario_bu('2026-10-19') order by bu, metrica;`.
   O canal de leitura normal costuma recusar esta função com "permission denied" (42501). Nesse caso, a consulta roda pelo canal administrativo, numa transação só de leitura (READ ONLY) desfeita no final, como nos relatórios de 13/10 a 18/10.
2. Colar a saída bruta linha a linha, sem resumir e sem mudar a ordem.
3. Registrar o pedido em roadmap.md e marcá-lo como concluído.

## O que não será feito
- Nenhum dado será inserido, alterado ou excluído. Não haverá migration, alteração de código nem publicação.
- A troca do card do Kawer para o William continua pendente e depende de nova aprovação.
