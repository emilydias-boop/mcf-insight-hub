# Relatório diário por BU de 15/10 (somente leitura)

## Situação
- Pelo canal de leitura, a consulta `select * from public.relatorio_diario_bu('2026-10-15') order by bu, metrica;` volta com o erro "permission denied" (42501). Esse canal não tem permissão para executar a função.

## O que será feito
1. Rodar a mesma consulta pelo canal administrativo, como nos relatórios de 13/10 e 14/10. A consulta roda dentro de uma transação só de leitura (READ ONLY), que é desfeita no final.
2. Colar a saída bruta linha a linha (bu, metrica e demais colunas), sem resumir e sem mudar a ordem.
3. Registrar o pedido em roadmap.md e marcá-lo como concluído.

## O que não será feito
- Nenhum dado será inserido, alterado ou excluído. Nenhuma migration, nenhuma alteração de código e nada publicado.
- A troca do card do Kawer para o William continua pendente. Ela só será feita com uma nova aprovação.
