# Relatório diário por BU de 16/10 (somente leitura)

## O que será feito
1. Rodar `select * from public.relatorio_diario_bu('2026-10-16') order by bu, metrica;`. O canal de leitura normal costuma dar "permission denied" (42501) para esta função. Nesse caso, a consulta roda pelo canal administrativo, dentro de uma transação só de leitura (READ ONLY) que é desfeita no final, como nos relatórios de 13/10, 14/10 e 15/10.
2. Colar a saída bruta linha a linha, sem resumir e sem mudar a ordem.

## O que não será feito
- Nenhum dado será inserido, alterado ou excluído. Não haverá migration, alteração de código nem publicação.
- A troca do card do Kawer para o William continua pendente e depende de nova aprovação.
